import { randomUUID } from "node:crypto";
import { Agent } from "../agent/agent.js";
import type { AgentErrorEvent, AgentEvent } from "../agent/events.js";
import { ToolPermissionService } from "../permissions/index.js";
import { buildSystemPrompt } from "../prompt/index.js";
import { createModel } from "../providers/factory.js";
import type { Message } from "../session/message.js";
import { settings } from "../settings/index.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { RunEventEnvelope, RunEventFilter } from "./event-hub.js";
import { RunEventHub } from "./event-hub.js";

export interface ChatOptions {
  provider: string;
  model: string;
  enabledTools?: string[];
}

interface StartRunInput {
  message: string;
  messages: Message[];
  options: ChatOptions;
  sessionId?: string;
  sessionSystemPrompt?: string;
  runtimeSystemPrompt?: string;
  onTerminalEvent?: (event: AgentEvent) => void;
}

interface RunState {
  runId: string;
  sessionId?: string;
  completed: boolean;
  events: RunEventEnvelope[];
  agent: Agent;
}

function isTerminalEvent(event: AgentEvent): boolean {
  return (
    event.type === "agent_complete" ||
    event.type === "agent_error" ||
    event.type === "agent_abort"
  );
}

function createRunId(): string {
  return `run_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

export class AIService {
  private readonly runEventHub = new RunEventHub();
  private readonly runs = new Map<string, RunState>();
  private readonly permissionService = new ToolPermissionService();

  constructor(
    private toolRegistry: ToolRegistry,
    private cwd: string = process.cwd(),
  ) {}

  startRun(input: StartRunInput): string {
    const runId = createRunId();
    const model = createModel(input.options.provider, input.options.model);
    const promptResult = buildSystemPrompt({
      cwd: this.cwd,
      provider: input.options.provider,
      model: input.options.model,
      sessionSystemPrompt: input.sessionSystemPrompt,
      runtimeSystemPrompt: input.runtimeSystemPrompt,
    });

    const agent = new Agent(model, this.toolRegistry, {
      permissionService: this.permissionService,
      loopGuard: settings.agent.get("loopGuard"),
      cwd: this.cwd,
      sessionId: input.sessionId,
    });

    const runState: RunState = {
      runId,
      sessionId: input.sessionId,
      completed: false,
      events: [],
      agent,
    };
    this.runs.set(runId, runState);

    void this.executeRun(runState, input, promptResult.systemPrompt);
    return runId;
  }

  private async executeRun(
    runState: RunState,
    input: StartRunInput,
    systemPrompt?: string,
  ): Promise<void> {
    try {
      for await (const event of runState.agent.run(
        input.message,
        input.messages,
        {
          enabledTools: input.options.enabledTools,
          runId: runState.runId,
          provider: input.options.provider,
          model: input.options.model,
          systemPrompt,
        },
      )) {
        const envelope: RunEventEnvelope = {
          run_id: runState.runId,
          session_id: runState.sessionId,
          event,
        };
        runState.events.push(envelope);
        this.runEventHub.publish(envelope);

        if (isTerminalEvent(event)) {
          runState.completed = true;
          input.onTerminalEvent?.(event);
        }
      }
    } catch (error) {
      const failureEvent: AgentErrorEvent = {
        type: "agent_error",
        error:
          error instanceof Error ? error.message : "Unexpected runtime failure",
        error_type: "unknown",
        run_id: runState.runId,
        seq: Number.MAX_SAFE_INTEGER,
        span_id: `span_${randomUUID()}`,
        parent_span_id: null,
        timestamp: new Date().toISOString(),
        iteration: 0,
      };
      const envelope: RunEventEnvelope = {
        run_id: runState.runId,
        session_id: runState.sessionId,
        event: failureEvent,
      };
      runState.events.push(envelope);
      runState.completed = true;
      this.runEventHub.publish(envelope);
      input.onTerminalEvent?.(failureEvent);
    }
  }

  abort(runId: string): boolean {
    const state = this.runs.get(runId);
    if (!state) {
      return false;
    }

    return state.agent.abort(runId);
  }

  async *subscribeEvents(
    filter: RunEventFilter = {},
    options: { signal?: AbortSignal; replay?: boolean } = {},
  ): AsyncGenerator<RunEventEnvelope> {
    if (options.replay !== false && filter.runId) {
      const state = this.runs.get(filter.runId);
      if (state) {
        for (const event of state.events) {
          yield event;
        }

        if (state.completed) {
          return;
        }
      }
    }

    for await (const event of this.runEventHub.subscribe(filter, {
      signal: options.signal,
    })) {
      yield event;
    }
  }

  async *chat(
    message: string,
    messages: Message[],
    options: ChatOptions,
  ): AsyncGenerator<AgentEvent> {
    const runId = this.startRun({
      message,
      messages,
      options,
    });

    for await (const envelope of this.subscribeEvents(
      { runId },
      { replay: true },
    )) {
      yield envelope.event;

      if (isTerminalEvent(envelope.event)) {
        return;
      }
    }
  }
}

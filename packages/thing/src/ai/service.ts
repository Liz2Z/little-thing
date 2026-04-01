import { Agent } from "../agent/agent.js";
import type { AgentEvent } from "../agent/events.js";
import { createModel } from "../providers/factory.js";
import type { Message } from "../session/message.js";
import type { ToolRegistry } from "../tools/registry.js";

export interface ChatOptions {
  provider: string;
  model: string;
  enabledTools?: string[];
}

export class AIService {
  private activeAgents: Map<string, Agent> = new Map();

  constructor(private toolRegistry: ToolRegistry) {}

  abort(runId: string): void {
    const agent = this.activeAgents.get(runId);
    if (agent) {
      agent.abort(runId);
      this.activeAgents.delete(runId);
    }
  }

  async *chat(
    message: string,
    messages: Message[],
    options: ChatOptions,
  ): AsyncGenerator<AgentEvent> {
    const model = createModel(options.provider, options.model);
    const agent = new Agent(model, this.toolRegistry);

    // generate a runId for tracking so abort works
    // actually agent.run will return a run_id in the first event, but we don't have it upfront.
    // wait, agent.run accepts options.runId? Yes! runId?: string
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.activeAgents.set(runId, agent);

    try {
      for await (const event of agent.run(message, messages, {
        enabledTools: options.enabledTools,
        runId,
        provider: options.provider, // pass through if needed
        model: options.model,
      })) {
        yield event;
      }
    } finally {
      this.activeAgents.delete(runId);
    }
  }
}

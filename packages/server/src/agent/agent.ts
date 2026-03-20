import { randomUUID } from 'crypto';
import type { AnthropicProvider } from '../providers/anthropic.js';
import type { Message } from '../session/types.js';
import type { ToolDefinition } from '../providers/types.js';
import type { ToolExecutor } from '../tools/registry.js';
import {
  AgentEventType,
  EventStatus,
  AgentStopReason,
  AgentErrorType,
  type AgentEvent,
  type AgentRunContext,
  type AgentStartEvent,
  type AgentThinkingEvent,
  type AgentContentEvent,
  type ToolUseEvent,
  type AgentCompleteEvent,
  type AgentErrorEvent,
  type AgentAbortEvent,
} from './types.js';
import { createAgentRunContext } from './context.js';

export class Agent {
  private activeRuns: Map<string, AgentRunContext> = new Map();

  constructor(
    private provider: AnthropicProvider,
    private toolExecutor: ToolExecutor,
    private defaultMaxIterations: number = 10
  ) {}

  abort(runId: string): boolean {
    const ctx = this.activeRuns.get(runId);
    if (ctx) {
      ctx.abort();
      return true;
    }
    return false;
  }

  async *run(
    message: string,
    messages: Message[],
    options: {
      enabledTools?: string[];
      maxIterations?: number;
      runId?: string;
      abortSignal?: AbortSignal;
    } = {}
  ): AsyncGenerator<AgentEvent> {
    const ctx = createAgentRunContext(
      options.enabledTools || this.toolExecutor.getAllDefinitions().map((t: ToolDefinition) => t.name),
      options.maxIterations || this.defaultMaxIterations,
      null,
      options.runId
    );

    this.activeRuns.set(ctx.run_id, ctx);

    yield this.createEvent<AgentStartEvent>(ctx, {
      type: AgentEventType.Start,
      status: EventStatus.Start,
      message,
      enabled_tools: ctx.enabled_tools,
      max_iterations: ctx.max_iterations,
    });

    try {
      messages = [...messages, {
        id: randomUUID(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }];

      for (ctx.iteration = 0; ctx.iteration < ctx.max_iterations; ctx.iteration++) {
        if (ctx.isAborted() || options.abortSignal?.aborted) {
          yield this.createEvent<AgentAbortEvent>(ctx, {
            type: AgentEventType.Abort,
            status: EventStatus.Completed,
            reason: 'User requested abort',
            iteration: ctx.iteration,
          });
          return;
        }

        const tools = ctx.enabled_tools
          .map(name => this.toolExecutor.getDefinition(name))
          .filter((t): t is ToolDefinition => t !== undefined);

        const response = await this.provider.chatWithTools(messages, tools);

        if (response.toolUses && response.toolUses.length > 0) {
          for (const toolUse of response.toolUses) {
            if (ctx.isAborted() || options.abortSignal?.aborted) {
              yield this.createEvent<AgentAbortEvent>(ctx, {
                type: AgentEventType.Abort,
                status: EventStatus.Completed,
                reason: 'User requested abort during tool execution',
                iteration: ctx.iteration,
              });
              return;
            }

            const toolSpan = ctx.createChildSpan();

            yield this.createEvent<ToolUseEvent>(toolSpan, {
              type: AgentEventType.ToolUse,
              status: EventStatus.Start,
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              input: toolUse.input,
              iteration: ctx.iteration,
            });

            const startTime = Date.now();
            let result: { success: boolean; output?: string; error?: string };

            try {
              result = await this.toolExecutor.execute(toolUse.name, toolUse.input);
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
            const duration = Date.now() - startTime;

            yield this.createEvent<ToolUseEvent>(toolSpan, {
              type: AgentEventType.ToolUse,
              status: result.success ? EventStatus.Completed : EventStatus.Failed,
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              input: toolUse.input,
              iteration: ctx.iteration,
              result: result.success ? result.output : undefined,
              error: result.success ? undefined : result.error,
              duration_ms: duration,
            });

            messages = this.addToolResultToMessages(messages, toolUse, result);
          }
        } else {
          if (response.content) {
            yield this.createEvent<AgentContentEvent>(ctx, {
              type: AgentEventType.Content,
              status: EventStatus.Completed,
              content: response.content,
              iteration: ctx.iteration,
            });
          }

          const assistantMessage: Message = {
            id: randomUUID(),
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          const stopReason = this.mapStopReason(response.stop_reason);

          yield this.createEvent<AgentCompleteEvent>(ctx, {
            type: AgentEventType.Complete,
            status: EventStatus.Completed,
            final_content: response.content,
            total_iterations: ctx.iteration + 1,
            stop_reason: stopReason,
            usage: response.usage,
          });

          return;
        }
      }

      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: '达到最大迭代次数限制',
        error_type: AgentErrorType.MaxIterations,
        iteration: ctx.iteration,
      });

    } catch (error) {
      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: error instanceof Error ? error.message : 'Unknown error',
        error_type: AgentErrorType.Unknown,
        iteration: ctx.iteration,
      });
    } finally {
      this.activeRuns.delete(ctx.run_id);
    }
  }

  private mapStopReason(reason?: string): AgentStopReason {
    switch (reason) {
      case 'end_turn':
        return AgentStopReason.EndTurn;
      case 'tool_use':
        return AgentStopReason.ToolUse;
      case 'max_tokens':
        return AgentStopReason.MaxTokens;
      case 'stop_sequence':
        return AgentStopReason.StopSequence;
      default:
        return AgentStopReason.EndTurn;
    }
  }

  private createEvent<T extends AgentEvent>(
    ctx: AgentRunContext,
    event: Omit<T, 'run_id' | 'seq' | 'span_id' | 'parent_span_id' | 'timestamp'>
  ): T {
    return {
      ...event,
      run_id: ctx.run_id,
      seq: ctx.nextSeq(),
      span_id: ctx.newSpanId(),
      parent_span_id: ctx.parent_span_id,
      timestamp: new Date().toISOString(),
    } as T;
  }

  private addToolResultToMessages(
    messages: Message[],
    toolUse: { id: string; name: string; input: unknown },
    result: { success: boolean; output?: string; error?: string }
  ): Message[] {
    const toolUseMessage: Message = {
      id: randomUUID(),
      role: 'assistant',
      content: [{
        type: 'tool_use',
        id: toolUse.id,
        name: toolUse.name as any,
        input: toolUse.input as any,
      }],
      timestamp: new Date().toISOString(),
    };

    const toolResultMessage: Message = {
      id: randomUUID(),
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result.success ? (result.output || '') : (result.error || ''),
        is_error: !result.success,
      }],
      timestamp: new Date().toISOString(),
    };

    return [...messages, toolUseMessage, toolResultMessage];
  }
}

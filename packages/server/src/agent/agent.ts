import { randomUUID } from 'node:crypto';
import { streamText } from 'ai';
import type { Message, ToolParamValue } from '../session/message.js';
import type { AnyTool } from '../tools/types.js';
import type { ToolExecutor } from '../tools/registry.js';
import { toCoreMessages } from '../session/convert.js';
import type {
  AgentStopReason,
  AgentEvent,
  AgentRunContext,
  AgentStartEvent,
  AgentThinkingEvent,
  AgentContentEvent,
  ToolUseEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentAbortEvent,
} from './agent-events.schema.js';
import { createAgentRunContext } from './context.js';

function toToolSet(tools: AnyTool[]): Record<string, any> {
  const toolSet: Record<string, any> = {};

  for (const tool of tools) {
    toolSet[tool.name] = {
      description: tool.description,
      parameters: tool.parameters,
      execute: async (args: any) => {
        const result = await tool.execute(`tool_${Date.now()}`, args);
        const textContent = result.content.find(c => c.type === 'text');
        return textContent?.text ?? JSON.stringify(result.content);
      },
    };
  }

  return toolSet;
}

export class Agent {
  private activeRuns: Map<string, AgentRunContext> = new Map();

  constructor(
    private model: any,
    private toolExecutor: ToolExecutor,
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
      runId?: string;
      abortSignal?: AbortSignal;
      provider?: string;
      model?: string;
    } = {},
  ): AsyncGenerator<AgentEvent> {
    const ctx = createAgentRunContext(
      options.enabledTools ||
        this.toolExecutor
          .getAllDefinitions()
          .map((t: AnyTool) => t.name),
      null,
      options.runId,
    );

    this.activeRuns.set(ctx.run_id, ctx);

    yield this.createEvent<AgentStartEvent>(ctx, {
      type: 'agent_start',
      status: 'start',
      message,
      enabled_tools: ctx.enabled_tools,
    });

    try {
      messages = [
        ...messages,
        {
          id: `msg_${randomUUID()}`,
          role: 'user',
          content: { type: 'text', text: message },
          timestamp: new Date().toISOString(),
        },
      ];

      while (true) {
        if (ctx.isAborted() || options.abortSignal?.aborted) {
          yield this.createEvent<AgentAbortEvent>(ctx, {
            type: 'agent_abort',
            status: 'completed',
            reason: 'User requested abort',
            iteration: ctx.iteration,
          });
          return;
        }

        ctx.iteration++;

        const tools = ctx.enabled_tools
          .map((name) => this.toolExecutor.getDefinition(name))
          .filter((t): t is AnyTool => t !== undefined);

        const result = streamText({
          model: this.model,
          messages: toCoreMessages(messages),
          tools: toToolSet(tools),
        });

        const toolCalls: Array<{ id: string; name: string; args: unknown }> = [];
        let thinkingContent = '';
        let responseContent = '';
        let finalUsage: { promptTokens: number; completionTokens: number } | undefined;
        let finalFinishReason: string | undefined;

        for await (const part of result.fullStream) {
          if (ctx.isAborted() || options.abortSignal?.aborted) {
            yield this.createEvent<AgentAbortEvent>(ctx, {
              type: 'agent_abort',
              status: 'completed',
              reason: 'User requested abort',
              iteration: ctx.iteration,
            });
            return;
          }

          switch (part.type) {
            case 'text-delta':
              responseContent += part.text;
              yield this.createEvent<AgentContentEvent>(ctx, {
                type: 'agent_content',
                status: 'pending',
                content: part.text,
                iteration: ctx.iteration,
              });
              break;

            case 'reasoning-delta':
              thinkingContent += (part as any).textDelta || '';
              yield this.createEvent<AgentThinkingEvent>(ctx, {
                type: 'agent_thinking',
                status: 'start',
                content: (part as any).textDelta || '',
                iteration: ctx.iteration,
              });
              break;

            case 'tool-call':
              if ('toolName' in part && 'toolCallId' in part) {
                toolCalls.push({
                  id: part.toolCallId,
                  name: part.toolName,
                  args: (part as any).args || {},
                });
              }
              break;

            case 'tool-result':
              break;

            case 'finish':
              if ('totalUsage' in part) {
                finalUsage = (part as any).totalUsage;
              }
              if ('finishReason' in part) {
                finalFinishReason = (part as any).finishReason;
              }
              break;

            case 'error':
              yield this.createEvent<AgentErrorEvent>(ctx, {
                type: 'agent_error',
                status: 'failed',
                error: (part as any).error?.message || 'Unknown error',
                error_type: 'llm_error',
                iteration: ctx.iteration,
              });
              return;
          }
        }

        if (thinkingContent) {
          yield this.createEvent<AgentThinkingEvent>(ctx, {
            type: 'agent_thinking',
            status: 'completed',
            content: thinkingContent,
            iteration: ctx.iteration,
          });
        }

        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            if (ctx.isAborted() || options.abortSignal?.aborted) {
              yield this.createEvent<AgentAbortEvent>(ctx, {
                type: 'agent_abort',
                status: 'completed',
                reason: 'User requested abort during tool execution',
                iteration: ctx.iteration,
              });
              return;
            }

            yield this.createEvent<ToolUseEvent>(ctx, {
              type: 'tool_use',
              status: 'start',
              tool_use_id: toolCall.id,
              tool_name: toolCall.name,
              input: toolCall.args,
              iteration: ctx.iteration,
            });

            const startTime = Date.now();
            let result: { success: boolean; output?: string; error?: string };

            try {
              result = await this.toolExecutor.execute(
                toolCall.name,
                toolCall.args as Record<string, unknown>,
              );
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
            const duration = Date.now() - startTime;

            yield this.createEvent<ToolUseEvent>(ctx, {
              type: 'tool_use',
              status: result.success ? 'completed' : 'failed',
              tool_use_id: toolCall.id,
              tool_name: toolCall.name,
              input: toolCall.args,
              iteration: ctx.iteration,
              result: result.success ? result.output : undefined,
              error: result.success ? undefined : result.error,
              duration_ms: duration,
            });

            messages = this.addToolResultToMessages(messages, toolCall, result);
          }
        } else {
          if (responseContent) {
            yield this.createEvent<AgentContentEvent>(ctx, {
              type: 'agent_content',
              status: 'completed',
              content: responseContent,
              iteration: ctx.iteration,
            });
          }

          const assistantMessage: Message = {
            id: `msg_${randomUUID()}`,
            role: 'assistant',
            content: { type: 'text', text: responseContent },
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          const stopReason = this.mapStopReason(finalFinishReason);

          yield this.createEvent<AgentCompleteEvent>(ctx, {
            type: 'agent_complete',
            status: 'completed',
            final_content: responseContent,
            total_iterations: ctx.iteration + 1,
            stop_reason: stopReason,
            usage: finalUsage
              ? {
                  input_tokens: finalUsage.promptTokens,
                  output_tokens: finalUsage.completionTokens,
                }
              : undefined,
          });

          return;
        }
      }
    } catch (error) {
      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: 'agent_error',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        error_type: 'unknown',
        iteration: ctx.iteration,
      });
    } finally {
      this.activeRuns.delete(ctx.run_id);
    }
  }

  private mapStopReason(reason?: string): AgentStopReason {
    switch (reason) {
      case 'stop':
        return 'end_turn';
      case 'tool-calls':
        return 'tool_use';
      case 'length':
        return 'max_tokens';
      case 'content-filter':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }

  private createEvent<T extends AgentEvent>(
    ctx: AgentRunContext,
    event: Omit<
      T,
      'run_id' | 'seq' | 'span_id' | 'parent_span_id' | 'timestamp'
    >,
  ): T {
    return {
      ...event,
      run_id: ctx.run_id,
      seq: ctx.nextSeq(),
      span_id: ctx.span_id,
      parent_span_id: ctx.parent_span_id,
      timestamp: new Date().toISOString(),
    } as T;
  }

  private addToolResultToMessages(
    messages: Message[],
    toolCall: { id: string; name: string; args: unknown },
    result: { success: boolean; output?: string; error?: string },
  ): Message[] {
    const toolUseMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: 'assistant',
      content: {
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.name,
        input: toolCall.args as Record<string, ToolParamValue>,
      },
      timestamp: new Date().toISOString(),
    };

    const toolResultMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: 'user',
      content: {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: result.success ? result.output || '' : result.error || '',
        is_error: !result.success,
      },
      timestamp: new Date().toISOString(),
    };

    return [...messages, toolUseMessage, toolResultMessage];
  }
}

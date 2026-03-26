import { randomUUID } from 'node:crypto';
import { streamText } from 'ai';
import type { Message } from '../session/types.js';
import type { AnyTool } from '../tools/types.js';
import type { ToolExecutor } from '../tools/registry.js';
import { toCoreMessages } from '../session/convert.js';
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

/**
 * 将内部工具定义转换为 AI SDK 的 ToolSet 格式
 */
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
      type: AgentEventType.Start,
      status: EventStatus.Start,
      message,
      enabled_tools: ctx.enabled_tools,
    });

    try {
      messages = [
        ...messages,
        {
          id: `msg_${randomUUID()}`,
          role: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        },
      ];

      while (true) {
        if (ctx.isAborted() || options.abortSignal?.aborted) {
          yield this.createEvent<AgentAbortEvent>(ctx, {
            type: AgentEventType.Abort,
            status: EventStatus.Completed,
            reason: 'User requested abort',
            iteration: ctx.iteration,
          });
          return;
        }

        ctx.iteration++;

        const tools = ctx.enabled_tools
          .map((name) => this.toolExecutor.getDefinition(name))
          .filter((t): t is AnyTool => t !== undefined);

        // 使用 AI SDK 的 streamText
        const result = streamText({
          model: this.model,
          messages: toCoreMessages(messages),
          tools: toToolSet(tools),
        });

        // 收集工具调用和内容
        const toolCalls: Array<{ id: string; name: string; args: unknown }> = [];
        let thinkingContent = '';
        let responseContent = '';
        let finalUsage: { promptTokens: number; completionTokens: number } | undefined;
        let finalFinishReason: string | undefined;

        // 处理流式响应
        for await (const part of result.fullStream) {
          if (ctx.isAborted() || options.abortSignal?.aborted) {
            yield this.createEvent<AgentAbortEvent>(ctx, {
              type: AgentEventType.Abort,
              status: EventStatus.Completed,
              reason: 'User requested abort',
              iteration: ctx.iteration,
            });
            return;
          }

          switch (part.type) {
            case 'text-delta':
              responseContent += part.text;
              yield this.createEvent<AgentContentEvent>(ctx, {
                type: AgentEventType.Content,
                status: EventStatus.Pending,
                content: part.text,
                iteration: ctx.iteration,
              });
              break;

            case 'reasoning-delta':
              thinkingContent += (part as any).textDelta || '';
              yield this.createEvent<AgentThinkingEvent>(ctx, {
                type: AgentEventType.Thinking,
                status: EventStatus.Start,
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
              // 工具结果会在后面处理
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
                type: AgentEventType.Error,
                status: EventStatus.Failed,
                error: (part as any).error?.message || 'Unknown error',
                error_type: AgentErrorType.LlmError,
                iteration: ctx.iteration,
              });
              return;
          }
        }

        // 完成 thinking 事件
        if (thinkingContent) {
          yield this.createEvent<AgentThinkingEvent>(ctx, {
            type: AgentEventType.Thinking,
            status: EventStatus.Completed,
            content: thinkingContent,
            iteration: ctx.iteration,
          });
        }

        // 如果有工具调用，执行工具
        if (toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            if (ctx.isAborted() || options.abortSignal?.aborted) {
              yield this.createEvent<AgentAbortEvent>(ctx, {
                type: AgentEventType.Abort,
                status: EventStatus.Completed,
                reason: 'User requested abort during tool execution',
                iteration: ctx.iteration,
              });
              return;
            }

            yield this.createEvent<ToolUseEvent>(ctx, {
              type: AgentEventType.ToolUse,
              status: EventStatus.Start,
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
              type: AgentEventType.ToolUse,
              status: result.success ? EventStatus.Completed : EventStatus.Failed,
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
          // 完成 content 事件
          if (responseContent) {
            yield this.createEvent<AgentContentEvent>(ctx, {
              type: AgentEventType.Content,
              status: EventStatus.Completed,
              content: responseContent,
              iteration: ctx.iteration,
            });
          }

          const assistantMessage: Message = {
            id: `msg_${randomUUID()}`,
            role: 'assistant',
            content: responseContent,
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          const stopReason = this.mapStopReason(finalFinishReason);

          yield this.createEvent<AgentCompleteEvent>(ctx, {
            type: AgentEventType.Complete,
            status: EventStatus.Completed,
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
      case 'stop':
        return AgentStopReason.EndTurn;
      case 'tool-calls':
        return AgentStopReason.ToolUse;
      case 'length':
        return AgentStopReason.MaxTokens;
      case 'content-filter':
        return AgentStopReason.StopSequence;
      default:
        return AgentStopReason.EndTurn;
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
      content: [
        {
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name as any,
          input: toolCall.args as any,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const toolResultMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: result.success ? result.output || '' : result.error || '',
          is_error: !result.success,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    return [...messages, toolUseMessage, toolResultMessage];
  }
}

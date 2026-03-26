import { randomUUID } from "crypto";
import type { AnthropicProvider } from "../providers/anthropic.js";
import type { Message } from "../session/types.js";
import type { ToolDefinition } from "../providers/types.js";
import type { ToolExecutor } from "../tools/registry.js";
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
} from "./types.js";
import { createAgentRunContext } from "./context.js";

export class Agent {
  private activeRuns: Map<string, AgentRunContext> = new Map();

  constructor(
    private provider: AnthropicProvider,
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
          .map((t: ToolDefinition) => t.name),
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
          role: "user",
          content: message,
          timestamp: new Date().toISOString(),
        },
      ];

      while (true) {
        if (ctx.isAborted() || options.abortSignal?.aborted) {
          yield this.createEvent<AgentAbortEvent>(ctx, {
            type: AgentEventType.Abort,
            status: EventStatus.Completed,
            reason: "User requested abort",
            iteration: ctx.iteration,
          });
          return;
        }

        ctx.iteration++;

        const tools = ctx.enabled_tools
          .map((name) => this.toolExecutor.getDefinition(name))
          .filter((t): t is ToolDefinition => t !== undefined);

        // 收集流式响应
        let thinkingContent = "";
        let responseContent = "";
        const collectedToolUses: Array<{ id: string; name: string; input: unknown }> = [];
        let finalUsage: { input_tokens: number; output_tokens: number } | undefined;
        let finalStopReason: string | undefined;

        // 处理流式响应
        for await (const chunk of this.provider.chatWithTools(
          messages,
          tools,
          options.model,
        )) {
          if (ctx.isAborted() || options.abortSignal?.aborted) {
            yield this.createEvent<AgentAbortEvent>(ctx, {
              type: AgentEventType.Abort,
              status: EventStatus.Completed,
              reason: "User requested abort",
              iteration: ctx.iteration,
            });
            return;
          }

          if (chunk.type === "thinking_delta") {
            thinkingContent += chunk.delta || "";
            yield this.createEvent<AgentThinkingEvent>(ctx, {
              type: AgentEventType.Thinking,
              status: EventStatus.Start,
              content: chunk.delta || "",  // 发送增量
              iteration: ctx.iteration,
            });
          } else if (chunk.type === "content_delta") {
            responseContent += chunk.delta || "";
            yield this.createEvent<AgentContentEvent>(ctx, {
              type: AgentEventType.Content,
              status: EventStatus.Pending,
              content: chunk.delta || "",  // 发送增量
              iteration: ctx.iteration,
            });
          } else if (chunk.type === "tool_use" && chunk.toolUse) {
            collectedToolUses.push(chunk.toolUse);
          } else if (chunk.type === "done" && chunk.response) {
            finalUsage = chunk.response.usage;
            finalStopReason = chunk.response.stop_reason;
            // 补全最终内容
            if (chunk.response.content) {
              responseContent = chunk.response.content;
            }
            if (chunk.response.thinking) {
              thinkingContent = chunk.response.thinking;
            }
          }
        }

        // Thinking 完成
        if (thinkingContent) {
          yield this.createEvent<AgentThinkingEvent>(ctx, {
            type: AgentEventType.Thinking,
            status: EventStatus.Completed,
            content: thinkingContent,
            iteration: ctx.iteration,
          });
        }

        if (collectedToolUses.length > 0) {
          for (const toolUse of collectedToolUses) {
            if (ctx.isAborted() || options.abortSignal?.aborted) {
              yield this.createEvent<AgentAbortEvent>(ctx, {
                type: AgentEventType.Abort,
                status: EventStatus.Completed,
                reason: "User requested abort during tool execution",
                iteration: ctx.iteration,
              });
              return;
            }

            yield this.createEvent<ToolUseEvent>(ctx, {
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
              result = await this.toolExecutor.execute(
                toolUse.name,
                toolUse.input,
              );
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
              };
            }
            const duration = Date.now() - startTime;

            yield this.createEvent<ToolUseEvent>(ctx, {
              type: AgentEventType.ToolUse,
              status: result.success
                ? EventStatus.Completed
                : EventStatus.Failed,
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
          // Content 完成
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
            role: "assistant",
            content: responseContent,
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          const stopReason = this.mapStopReason(finalStopReason);

          yield this.createEvent<AgentCompleteEvent>(ctx, {
            type: AgentEventType.Complete,
            status: EventStatus.Completed,
            final_content: responseContent,
            total_iterations: ctx.iteration + 1,
            stop_reason: stopReason,
            usage: finalUsage,
          });

          return;
        }
      }
    } catch (error) {
      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: error instanceof Error ? error.message : "Unknown error",
        error_type: AgentErrorType.Unknown,
        iteration: ctx.iteration,
      });
    } finally {
      this.activeRuns.delete(ctx.run_id);
    }
  }

  private mapStopReason(reason?: string): AgentStopReason {
    switch (reason) {
      case "end_turn":
        return AgentStopReason.EndTurn;
      case "tool_use":
        return AgentStopReason.ToolUse;
      case "max_tokens":
        return AgentStopReason.MaxTokens;
      case "stop_sequence":
        return AgentStopReason.StopSequence;
      default:
        return AgentStopReason.EndTurn;
    }
  }

  private createEvent<T extends AgentEvent>(
    ctx: AgentRunContext,
    event: Omit<
      T,
      "run_id" | "seq" | "span_id" | "parent_span_id" | "timestamp"
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
    toolUse: { id: string; name: string; input: unknown },
    result: { success: boolean; output?: string; error?: string },
  ): Message[] {
    const toolUseMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: toolUse.id,
          name: toolUse.name as any,
          input: toolUse.input as any,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const toolResultMessage: Message = {
      id: `msg_${randomUUID()}`,
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.success ? result.output || "" : result.error || "",
          is_error: !result.success,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    return [...messages, toolUseMessage, toolResultMessage];
  }
}

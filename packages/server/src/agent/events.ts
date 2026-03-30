import { z } from "zod";

/**
 * 事件状态枚举
 *
 * 用于标记有生命周期的事件在其进行中的阶段：
 * - pending: 事件进行中（如流式输出、工具执行等待）
 * - completed: 事件已成功完成
 * - failed: 事件执行失败
 */
export const EventStatusSchema = z.enum(["pending", "completed", "failed"]);

export type EventStatus = z.infer<typeof EventStatusSchema>;

/**
 * Agent 运行终止原因
 *
 * - end_turn: LLM 主动结束回复（正常结束）
 * - tool_use: LLM 请求调用工具，需要执行工具后继续
 * - max_tokens: 输出达到 token 上限被截断
 * - stop_sequence: 遇到预设的停止序列
 * - user_abort: 用户主动中断
 * - error: 执行过程中发生错误
 * - timeout: 执行超时
 */
export const AgentStopReasonSchema = z.enum([
  "end_turn",
  "tool_use",
  "max_tokens",
  "stop_sequence",
  "user_abort",
  "error",
  "timeout",
]);

export type AgentStopReason = z.infer<typeof AgentStopReasonSchema>;

/**
 * Agent 错误类型分类
 *
 * - llm_error: LLM API 调用错误（如限流、服务不可用）
 * - tool_error: 工具执行过程中的错误
 * - timeout: 整体执行超时
 * - user_abort: 用户主动取消
 * - unknown: 未知/未预期的错误
 */
export const AgentErrorTypeSchema = z.enum([
  "llm_error",
  "tool_error",
  "timeout",
  "user_abort",
  "unknown",
]);

export type AgentErrorType = z.infer<typeof AgentErrorTypeSchema>;

/**
 * Agent 事件类型枚举
 *
 * 定义了 Agent 运行过程中可能产生的所有事件类型，
 * 用于 SSE 推送和内部事件流转：
 * - agent_start: Agent 开始运行
 * - agent_thinking: Agent 思考过程（reasoning/thinking 内容）
 * - agent_content: Agent 输出的正文内容
 * - tool_use: 工具调用相关事件
 * - agent_complete: Agent 运行完成
 * - agent_error: Agent 运行出错
 * - agent_abort: Agent 被中断
 */
export const AgentEventTypeSchema = z.enum([
  "agent_start",
  "agent_thinking",
  "agent_content",
  "tool_use",
  "agent_complete",
  "agent_error",
  "agent_abort",
]);

export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

/**
 * 所有 Agent 事件的公共基础字段
 *
 * 每个事件都包含以下元信息：
 * - type: 事件类型，用于 discriminated union 分发
 * - run_id: 一次 Agent 运行的唯一标识，同一次 run 下所有事件共享
 * - seq: 事件序号，单调递增，用于保证事件顺序
 * - span_id: 当前 span 的唯一标识，用于链路追踪
 * - parent_span_id: 父 span 标识，构成 span 树（顶层事件为 null）
 * - timestamp: ISO 8601 时间戳
 */
export const AgentEventBaseSchema = z.object({
  type: AgentEventTypeSchema,
  run_id: z.string(),
  seq: z.number(),
  span_id: z.string(),
  parent_span_id: z.string().nullable(),
  timestamp: z.string(),
});

export type AgentEventBase = z.infer<typeof AgentEventBaseSchema>;

/**
 * Agent 启动事件
 *
 * 在 Agent 开始运行时发出，携带初始配置信息：
 * - message: 用户发送的原始消息
 * - enabled_tools: 本次运行启用的工具名称列表
 */
export const AgentStartEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_start"),
  message: z.string(),
  enabled_tools: z.array(z.string()),
});

export type AgentStartEvent = z.infer<typeof AgentStartEventSchema>;

/**
 * Agent 思考事件
 *
 * 对应 LLM 的 thinking/reasoning 内容块：
 * - pending/completed 分别标记思考进行中和结束
 * - content: 思考的具体文本
 * - iteration: 当前处于第几轮 LLM 调用（工具调用会触发多轮）
 */
export const AgentThinkingEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_thinking"),
  status: z.union([z.literal("pending"), z.literal("completed")]),
  content: z.string(),
  iteration: z.number(),
});

export type AgentThinkingEvent = z.infer<typeof AgentThinkingEventSchema>;

/**
 * Agent 内容输出事件
 *
 * 对应 LLM 输出的正文内容（非 thinking 部分）：
 * - pending: 流式输出中
 * - completed: 输出完成
 * - content: 输出的文本
 * - iteration: 当前轮次
 */
export const AgentContentEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_content"),
  status: z.union([z.literal("pending"), z.literal("completed")]),
  content: z.string(),
  iteration: z.number(),
});

export type AgentContentEvent = z.infer<typeof AgentContentEventSchema>;

/**
 * 工具调用事件
 *
 * 覆盖工具调用的完整生命周期：
 * - pending: 工具执行中
 * - completed: 工具执行成功，result 中包含返回结果
 * - failed: 工具执行失败，error 中包含错误信息
 *
 * 额外字段：
 * - tool_use_id: 对应 LLM 返回的 tool_use block ID
 * - tool_name: 被调用的工具名称
 * - input: 传给工具的输入参数
 * - result: 工具执行结果（仅 completed 时有值）
 * - error: 错误信息（仅 failed 时有值）
 * - duration_ms: 工具执行耗时（毫秒）
 */
export const ToolUseEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("tool_use"),
  status: z.union([
    z.literal("pending"),
    z.literal("completed"),
    z.literal("failed"),
  ]),
  tool_use_id: z.string(),
  tool_name: z.string(),
  input: z.unknown(),
  iteration: z.number(),
  result: z.string().optional(),
  error: z.string().optional(),
  duration_ms: z.number().optional(),
});

export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

/**
 * Agent 运行完成事件
 *
 * 在 Agent 正常结束运行时发出（无论是因为正常回复结束还是被中断）：
 * - final_content: Agent 最终输出的完整内容
 * - total_iterations: 总共进行了多少轮 LLM 调用
 * - stop_reason: 终止原因
 * - usage: token 使用量统计（可选，依赖 provider 是否返回）
 */
export const AgentCompleteEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_complete"),
  final_content: z.string(),
  total_iterations: z.number(),
  stop_reason: AgentStopReasonSchema,
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    })
    .optional(),
});

export type AgentCompleteEvent = z.infer<typeof AgentCompleteEventSchema>;

/**
 * Agent 错误事件
 *
 * 在 Agent 运行过程中发生不可恢复的错误时发出：
 * - error: 错误描述信息
 * - error_type: 错误分类
 * - iteration: 发生错误时的轮次（可选）
 */
export const AgentErrorEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_error"),
  error: z.string(),
  error_type: AgentErrorTypeSchema,
  iteration: z.number().optional(),
});

export type AgentErrorEvent = z.infer<typeof AgentErrorEventSchema>;

/**
 * Agent 中断事件
 *
 * 在用户主动中断 Agent 运行时发出：
 * - reason: 中断原因描述
 * - iteration: 被中断时的轮次
 */
export const AgentAbortEventSchema = AgentEventBaseSchema.extend({
  type: z.literal("agent_abort"),
  reason: z.string(),
  iteration: z.number(),
});

export type AgentAbortEvent = z.infer<typeof AgentAbortEventSchema>;

/**
 * Agent 事件联合类型（discriminated union）
 *
 * 通过 type 字段进行区分，配合 TypeScript 的类型收窄使用：
 * @example
 * switch (event.type) {
 *   case 'agent_start': // event 被收窄为 AgentStartEvent
 * }
 */
export const AgentEventSchema = z.discriminatedUnion("type", [
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentContentEventSchema,
  ToolUseEventSchema,
  AgentCompleteEventSchema,
  AgentErrorEventSchema,
  AgentAbortEventSchema,
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

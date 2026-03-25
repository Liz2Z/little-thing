/**
 * 事件状态枚举
 */
export enum EventStatus {
  Start = 'start',
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Agent 停止原因枚举
 */
export enum AgentStopReason {
  /** 正常结束，LLM 决定回复用户 */
  EndTurn = 'end_turn',
  /** 需要调用工具 */
  ToolUse = 'tool_use',
  /** 达到最大 token 限制 */
  MaxTokens = 'max_tokens',
  /** 遇到停止序列 */
  StopSequence = 'stop_sequence',
  /** 用户主动终止 */
  UserAbort = 'user_abort',
  /** 发生错误 */
  Error = 'error',
  /** 超时 */
  Timeout = 'timeout',
}

/**
 * Agent 错误类型枚举
 */
export enum AgentErrorType {
  LlmError = 'llm_error',
  ToolError = 'tool_error',
  Timeout = 'timeout',
  UserAbort = 'user_abort',
  Unknown = 'unknown',
}

/**
 * Agent 事件类型枚举
 */
export enum AgentEventType {
  Start = 'agent_start',
  Thinking = 'agent_thinking',
  Content = 'agent_content',
  ToolUse = 'tool_use',
  Complete = 'agent_complete',
  Error = 'agent_error',
  Abort = 'agent_abort',
}

/**
 * Agent 事件基础接口
 * 所有事件都包含追踪标识，用于处理并发和嵌套场景
 *
 * 重要：同一个 run 里的所有事件 run_id 都是相同的，
 * 包括子 agent 调用，通过 parent_span_id 区分层级
 */
export interface AgentEventBase {
  /** 事件类型 */
  type: AgentEventType;
  /**
   * 运行实例 ID - 标识一次完整的 Agent 运行
   * 用于区分并发执行的多个 Agent 实例
   * 同一次运行中所有事件（包括子 agent）共享同一个 run_id
   */
  run_id: string;
  /**
   * 序列号 - 同一 run_id 内的事件顺序
   * 前端可根据 seq 排序渲染，防止网络乱序
   */
  seq: number;
  /**
   * Span ID - 当前事件的唯一标识
   * 用于构建调用链和关联父子关系
   */
  span_id: string;
  /**
   * 父 Span ID - 标识父级事件
   * 用于支持嵌套调用（如子 agent）
   * 根事件为 null
   */
  parent_span_id: string | null;
  /** 事件时间戳 */
  timestamp: string;
  /**
   * 事件状态
   * 用于表示事件的生命周期状态
   */
  status: EventStatus;
}

/** Agent 运行开始事件 */
export interface AgentStartEvent extends AgentEventBase {
  type: AgentEventType.Start;
  status: EventStatus.Start;
  /** 初始消息 */
  message: string;
  /** 启用的工具列表 */
  enabled_tools: string[];
}

/** Agent 思考事件 - LLM 内部思考过程 */
export interface AgentThinkingEvent extends AgentEventBase {
  type: AgentEventType.Thinking;
  status: EventStatus.Start | EventStatus.Completed;
  /** 思考内容 */
  content: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** Agent 文本输出事件 */
export interface AgentContentEvent extends AgentEventBase {
  type: AgentEventType.Content;
  status: EventStatus.Start | EventStatus.Pending | EventStatus.Completed;
  /** 文本内容（流式时可能分段） */
  content: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** 工具调用事件 */
export interface ToolUseEvent extends AgentEventBase {
  type: AgentEventType.ToolUse;
  status: EventStatus.Start | EventStatus.Pending | EventStatus.Completed | EventStatus.Failed;
  /** 工具调用 ID */
  tool_use_id: string;
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  input: unknown;
  /** 当前迭代轮次 */
  iteration: number;
  /** 执行结果（status 为 completed/failed 时） */
  result?: string;
  /** 错误信息（status 为 failed 时） */
  error?: string;
  /** 执行耗时（毫秒） */
  duration_ms?: number;
}

/** Agent 运行完成事件 */
export interface AgentCompleteEvent extends AgentEventBase {
  type: AgentEventType.Complete;
  status: EventStatus.Completed;
  /** 最终回复内容 */
  final_content: string;
  /** 总迭代次数 */
  total_iterations: number;
  /** 停止原因 */
  stop_reason: AgentStopReason;
  /** Token 使用情况 */
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/** Agent 运行错误事件 */
export interface AgentErrorEvent extends AgentEventBase {
  type: AgentEventType.Error;
  status: EventStatus.Failed;
  /** 错误信息 */
  error: string;
  /** 错误类型 */
  error_type: AgentErrorType;
  /** 当前迭代轮次 */
  iteration?: number;
}

/** Agent 终止事件 - 用户主动终止 */
export interface AgentAbortEvent extends AgentEventBase {
  type: AgentEventType.Abort;
  status: EventStatus.Completed;
  /** 终止原因 */
  reason: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** 所有 Agent 事件类型联合 */
export type AgentEvent =
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentContentEvent
  | ToolUseEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentAbortEvent;

/**
 * Agent 运行上下文
 * 用于管理一次 Agent 运行的状态和追踪信息
 */
export interface AgentRunContext {
  /** 运行 ID */
  run_id: string;
  /** 父级 Span ID（用于嵌套调用） */
  parent_span_id: string | null;
  /** 当前序列号计数器 */
  seq_counter: number;
  /** 当前迭代轮次 */
  iteration: number;
  /** 已启用的工具 */
  enabled_tools: string[];
  /** 是否被终止 */
  aborted: boolean;

  /** 生成下一个序列号 */
  nextSeq(): number;

  /** 生成新的 Span ID */
  newSpanId(): string;

  /** 创建子上下文（用于嵌套调用，共享 run_id） */
  createChildSpan(): AgentRunContext;

  /** 标记为终止 */
  abort(): void;

  /** 检查是否已终止 */
  isAborted(): boolean;
}

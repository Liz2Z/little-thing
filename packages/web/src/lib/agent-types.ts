/**
 * Agent 事件类型定义
 * 与服务器端 Agent 事件类型保持同步
 */

export enum EventStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

export enum AgentStopReason {
  EndTurn = 'end_turn',
  ToolUse = 'tool_use',
  MaxTokens = 'max_tokens',
  StopSequence = 'stop_sequence',
  MaxIterations = 'max_iterations',
  UserAbort = 'user_abort',
  Error = 'error',
  Timeout = 'timeout',
}

export enum AgentErrorType {
  LlmError = 'llm_error',
  ToolError = 'tool_error',
  Timeout = 'timeout',
  MaxIterations = 'max_iterations',
  UserAbort = 'user_abort',
  Unknown = 'unknown',
}

export enum AgentEventType {
  Start = 'agent_start',
  Thinking = 'agent_thinking',
  Content = 'agent_content',
  ToolUse = 'tool_use',
  Complete = 'agent_complete',
  Error = 'agent_error',
  Abort = 'agent_abort',
}

export interface AgentEventBase {
  type: AgentEventType;
  run_id: string;
  seq: number;
  span_id: string;
  parent_span_id: string | null;
  timestamp: string;
}

export interface AgentStartEvent extends AgentEventBase {
  type: AgentEventType.Start;
  message: string;
  enabled_tools: string[];
  max_iterations: number;
}

export interface AgentThinkingEvent extends AgentEventBase {
  type: AgentEventType.Thinking;
  status: EventStatus.Pending | EventStatus.Completed;
  content: string;
  iteration: number;
}

export interface AgentContentEvent extends AgentEventBase {
  type: AgentEventType.Content;
  status: EventStatus.Pending | EventStatus.Completed;
  content: string;
  iteration: number;
}

export interface ToolUseEvent extends AgentEventBase {
  type: AgentEventType.ToolUse;
  status: EventStatus.Pending | EventStatus.Completed | EventStatus.Failed;
  tool_use_id: string;
  tool_name: string;
  input: unknown;
  iteration: number;
  result?: string;
  error?: string;
  duration_ms?: number;
}

export interface AgentCompleteEvent extends AgentEventBase {
  type: AgentEventType.Complete;
  final_content: string;
  total_iterations: number;
  stop_reason: AgentStopReason;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AgentErrorEvent extends AgentEventBase {
  type: AgentEventType.Error;
  error: string;
  error_type: AgentErrorType;
  iteration?: number;
}

export interface AgentAbortEvent extends AgentEventBase {
  type: AgentEventType.Abort;
  reason: string;
  iteration: number;
}

export type AgentEvent =
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentContentEvent
  | ToolUseEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentAbortEvent;

export interface AgentRunState {
  run_id: string;
  status: 'running' | 'completed' | 'error' | 'aborted';
  thinking?: string;
  content: string;
  toolCalls: Map<string, ToolUseEvent>;
  startTime: number;
  endTime?: number;
  error?: string;
  stop_reason?: AgentStopReason;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

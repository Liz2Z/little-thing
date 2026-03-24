/**
 * 工具名称类型
 * 支持的工具列表：ls, read, edit, write, grep, glob
 */
export type ToolName = 'ls' | 'read' | 'edit' | 'write' | 'grep' | 'glob';

/** 工具参数值类型 */
export type ToolParamValue = string | number | boolean | undefined;

/** 工具参数接口 */
export interface ToolParams {
  [key: string]: ToolParamValue;
}

/**
 * 工具使用内容接口
 * LLM 请求调用工具时的消息内容
 */
export interface ToolUseContent {
  /** 内容类型：工具使用 */
  type: 'tool_use';
  /** 工具调用 ID */
  id: string;
  /** 工具名称 */
  name: ToolName;
  /** 工具输入参数 */
  input: ToolParams;
}

/**
 * 工具结果内容接口
 * 工具执行结果的消息内容
 */
export interface ToolResultContent {
  /** 内容类型：工具结果 */
  type: 'tool_result';
  /** 对应的工具调用 ID */
  tool_use_id: string;
  /** 工具执行结果内容 */
  content: string;
  /** 是否为错误结果 */
  is_error?: boolean;
}

/**
 * 消息内容类型
 * 支持纯文本或工具调用/结果数组
 */
export type MessageContent = string | (ToolUseContent | ToolResultContent)[];

export interface Message {
  /** 消息 ID */
  id: string;
  /** 消息角色 */
  role: 'system' | 'user' | 'assistant';
  /** 消息内容 */
  content: MessageContent;
  /** 消息时间戳 */
  timestamp: string;
}

export interface SessionMeta {
  /** 会话 ID */
  id: string;
  /** 会话名称 */
  name: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 消息数量 */
  messageCount: number;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 父会话 ID */
  parentSessionId?: string;
  /** 分叉来源消息 ID */
  forkedFromMessageId?: string;
  /** LLM Provider 名称 */
  provider?: string;
  /** LLM 模型名称 */
  model?: string;
}

export interface SessionIndex {
  /** 会话元数据映射 */
  sessions: Record<string, SessionMeta>;
}

export interface Session {
  /** 会话元数据 */
  meta: SessionMeta;
  /** 消息列表 */
  messages: Message[];
}

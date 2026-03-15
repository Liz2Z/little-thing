/**
 * 自动生成的 API 类型定义
 * 基于 OpenAPI schema 生成
 * 不要手动修改此文件
 */

export interface HealthCheckResponse {
  /** 服务状态 */
  status: string;
  /** 当前使用的模型 */
  model: string;
}

export interface SessionsListResponse {
  /** 会话列表 */
  sessions: Array<{
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
  }>;
}

export interface SessionsCreateRequest {
  /** 会话名称 */
  name?: string;
}

export interface SessionsCreateResponse {
  /** 创建的会话 */
  session: {
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
  };
}

export interface SessionsGetResponse {
  /** 会话详情 */
  session: {
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
    /** 消息列表 */
    messages: Array<{
      /** 消息 ID */
      id: string;
      /** 消息角色 */
      role: 'user' | 'assistant' | 'system';
      /** 消息内容 */
      content: string;
      /** 消息时间 */
      timestamp: string;
    }>;
  };
}

export interface SessionsDeleteResponse {
  /** 操作是否成功 */
  success: boolean;
}

export interface SessionsRenameRequest {
  /** 新会话名称 */
  name: string;
}

export interface SessionsRenameResponse {
  /** 操作是否成功 */
  success: boolean;
}

export interface SessionsForkRequest {
  /** 消息 ID */
  messageId: string;
  /** 新会话名称 */
  name?: string;
}

export interface SessionsForkResponse {
  /** 新创建的会话 */
  session: {
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
  };
}

export interface SessionsResumeRequest {
  /** 消息 ID */
  messageId: string;
}

export interface SessionsResumeResponse {
  /** 操作是否成功 */
  success: boolean;
}

export interface SessionsMessagesAddRequest {
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 消息时间 */
  timestamp?: string;
}

export interface SessionsMessagesAddResponse {
  /** 操作是否成功 */
  success: boolean;
}

export interface SessionsChatSendRequest {
  /** 用户消息 */
  message: string;
}

export interface SessionsChatSendResponse {
  /** AI 响应 */
  response: string;
  /** Token 使用情况 */
  usage?: {
    /** 输入 token 数 */
    promptTokens: number;
    /** 输出 token 数 */
    completionTokens: number;
    /** 总 token 数 */
    totalTokens: number;
  };
}

export interface SessionsChatStreamRequest {
  /** 用户消息 */
  message: string;
}

export interface ChatSendRequest {
  /** 消息历史 */
  messages: Array<{
    /** 消息 ID */
    id: string;
    /** 消息角色 */
    role: 'user' | 'assistant' | 'system';
    /** 消息内容 */
    content: string;
    /** 消息时间 */
    timestamp: string;
  }>;
}

export interface ChatSendResponse {
  /** AI 响应 */
  response: string;
  /** Token 使用情况 */
  usage?: {
    /** 输入 token 数 */
    promptTokens: number;
    /** 输出 token 数 */
    completionTokens: number;
    /** 总 token 数 */
    totalTokens: number;
  };
}

export interface ChatStreamRequest {
  /** 消息历史 */
  messages: Array<{
    /** 消息 ID */
    id: string;
    /** 消息角色 */
    role: 'user' | 'assistant' | 'system';
    /** 消息内容 */
    content: string;
    /** 消息时间 */
    timestamp: string;
  }>;
}


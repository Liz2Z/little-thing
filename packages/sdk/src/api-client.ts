/**
 * 自动生成的 SDK 客户端
 * 基于 OpenAPI operationId 生成语义化调用链
 * 不要手动修改此文件
 */

import type {
  HealthCheckResponse,
  SessionsListResponse,
  SessionsCreateRequest,
  SessionsCreateResponse,
  SessionsGetResponse,
  SessionsDeleteResponse,
  SessionsRenameRequest,
  SessionsRenameResponse,
  SessionsMessagesAddRequest,
  SessionsMessagesAddResponse,
  SessionsChatSendRequest,
  SessionsChatSendResponse,
  SessionsChatStreamRequest,
  ChatSendRequest,
  ChatSendResponse,
  ChatStreamRequest,
} from './api-types.js';

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class ChatApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 无会话聊天
   * 直接发送消息进行聊天，不需要会话
   */
  async send(body: ChatSendRequest): Promise<ChatSendResponse> {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<ChatSendResponse>;
  }

  /**
   * 无会话流式聊天
   * 直接发送消息进行流式聊天，不需要会话
   */
  async stream(body: ChatStreamRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return;
  }

}

export class HealthApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 健康检查
   * 检查服务是否正常运行
   */
  async check(): Promise<HealthCheckResponse> {
    const response = await fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<HealthCheckResponse>;
  }

}

export class SessionsApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 获取会话列表
   * 获取所有会话的列表
   */
  async list(): Promise<SessionsListResponse> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsListResponse>;
  }

  /**
   * 创建新会话
   * 创建一个新的聊天会话
   */
  async create(body: SessionsCreateRequest): Promise<SessionsCreateResponse> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsCreateResponse>;
  }

  /**
   * 获取会话详情
   * 根据 ID 获取会话的详细信息，包括消息历史
   */
  async get(id: string): Promise<SessionsGetResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'GET',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsGetResponse>;
  }

  /**
   * 删除会话
   * 根据 ID 删除指定会话
   */
  async delete(id: string): Promise<SessionsDeleteResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsDeleteResponse>;
  }

  /**
   * 重命名会话
   * 修改会话名称
   */
  async rename(id: string, body: SessionsRenameRequest): Promise<SessionsRenameResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsRenameResponse>;
  }

  chat!: SessionsChatApi;

  messages!: SessionsMessagesApi;

}

export class SessionsChatApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 会话聊天
   * 在指定会话中进行聊天，返回 AI 响应
   */
  async send(id: string, body: SessionsChatSendRequest): Promise<SessionsChatSendResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsChatSendResponse>;
  }

  /**
   * 会话流式聊天
   * 在指定会话中进行流式聊天，实时返回 AI 响应
   */
  async stream(id: string, body: SessionsChatStreamRequest): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}/chat/stream`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return;
  }

}

export class SessionsMessagesApi {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  /**
   * 添加消息到会话
   * 向指定会话添加一条消息
   */
  async add(id: string, body: SessionsMessagesAddRequest): Promise<SessionsMessagesAddResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<SessionsMessagesAddResponse>;
  }

}

export class ApiClient {
  private config: ApiClientConfig;
  chat: ChatApi;
  health: HealthApi;
  sessions: SessionsApi;

  constructor(config: ApiClientConfig = {}) {
    this.config = config;
    this.chat = new ChatApi(config);
    this.health = new HealthApi(config);
    this.sessions = new SessionsApi(config);
    this.sessions.chat = new SessionsChatApi(config);
    this.sessions.messages = new SessionsMessagesApi(config);
  }
}

export const createApiClient = (config?: ApiClientConfig) => new ApiClient(config);

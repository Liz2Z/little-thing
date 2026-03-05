/**
 * 自动生成的 SDK 客户端
 * 基于 OpenAPI operationId 生成语义化调用链
 * 不要手动修改此文件
 */

import type { paths } from './schema.js';

export type { paths } from './schema.js';

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

  async send(): Promise<Response> {
    return fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: this.headers,
    });
  }

  async stream(): Promise<Response> {
    return fetch(`${this.baseUrl}/chat/stream`, {
      method: 'POST',
      headers: this.headers,
    });
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

  async check(): Promise<Response> {
    return fetch(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: this.headers,
    });
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

  async list(): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions`, {
      method: 'GET',
      headers: this.headers,
    });
  }

  async create(): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: this.headers,
    });
  }

  async get(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'GET',
      headers: this.headers,
    });
  }

  async delete(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'DELETE',
      headers: this.headers,
    });
  }

  async rename(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'PUT',
      headers: this.headers,
    });
  }

  async chat(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}/chat`, {
      method: 'POST',
      headers: this.headers,
    });
  }

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

  async stream(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}/chat/stream`, {
      method: 'POST',
      headers: this.headers,
    });
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

  async add(id: string): Promise<Response> {
    return fetch(`${this.baseUrl}/sessions/${id}/messages`, {
      method: 'POST',
      headers: this.headers,
    });
  }

}

export class ApiClient {
  private config: ApiClientConfig;
  chat: ChatApi;
  health: HealthApi;
  sessions: SessionsApi;
  sessions: SessionsChatApi;
  sessions: SessionsMessagesApi;

  constructor(config: ApiClientConfig = {}) {
    this.config = config;
    this.chat = new ChatApi(config);
    this.health = new HealthApi(config);
    this.sessions = new SessionsApi(config);
    this.sessions = new SessionsChatApi(config);
    this.sessions = new SessionsMessagesApi(config);
  }
}

export const createApiClient = (config?: ApiClientConfig) => new ApiClient(config);

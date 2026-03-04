import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

export type { paths } from './schema.js';

export type ApiClientConfig = {
  baseUrl?: string;
  headers?: Record<string, string>;
};

export class ApiClient {
  private client: ReturnType<typeof createClient<paths>>;

  constructor(config: ApiClientConfig = {}) {
    const baseUrl = config.baseUrl || 'http://localhost:3000';
    this.client = createClient<paths>({
      baseUrl,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    });
  }

  async health() {
    return this.client.GET('/health');
  }

  async listSessions() {
    return this.client.GET('/sessions');
  }

  async createSession(name?: string) {
    return this.client.POST('/sessions', {
      body: { name },
    });
  }

  async getSession(id: string) {
    return this.client.GET('/sessions/{id}', {
      params: { path: { id } },
    });
  }

  async deleteSession(id: string) {
    return this.client.DELETE('/sessions/{id}', {
      params: { path: { id } },
    });
  }

  async renameSession(id: string, name: string) {
    return this.client.PUT('/sessions/{id}', {
      params: { path: { id } },
      body: { name },
    });
  }

  async addMessage(sessionId: string, message: { role: 'user' | 'assistant' | 'system'; content: string }) {
    return this.client.POST('/sessions/{id}/messages', {
      params: { path: { id: sessionId } },
      body: message,
    });
  }

  async chat(sessionId: string, message: string) {
    return this.client.POST('/sessions/{id}/chat', {
      params: { path: { id: sessionId } },
      body: { message },
    });
  }

  async *streamChat(sessionId: string, message: string): AsyncGenerator<string> {
    const baseUrl = this.client.baseUrl || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async chatWithoutSession(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>) {
    return this.client.POST('/chat', {
      body: { messages },
    });
  }

  async *streamChatWithoutSession(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }>): AsyncGenerator<string> {
    const baseUrl = this.client.baseUrl || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const createApiClient = (config?: ApiClientConfig) => new ApiClient(config);

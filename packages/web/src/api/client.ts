import { createApiClient, type SessionsListResponse, type SessionsCreateResponse } from '@littlething/sdk';
import type { Session, Message } from './types';

export type { Session, Message } from './types';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export class ApiClient {
  private client: ReturnType<typeof createApiClient>;
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
    this.client = createApiClient({ baseUrl });
  }

  async getSessions(): Promise<SessionsListResponse['sessions']> {
    const { sessions } = await this.client.sessions.list();
    return sessions;
  }

  async createSession(name?: string): Promise<SessionsCreateResponse['session']> {
    const { session } = await this.client.sessions.create({ name });
    return session;
  }

  async getSession(id: string): Promise<Session & { messages: Message[] }> {
    const { session } = await this.client.sessions.get(id);
    return session as unknown as Session & { messages: Message[] };
  }

  async deleteSession(id: string): Promise<void> {
    await this.client.sessions.delete(id);
  }

  async renameSession(id: string, name: string): Promise<void> {
    await this.client.sessions.rename(id, { name });
  }

  async forkSession(sessionId: string, messageId: string, name?: string): Promise<SessionsCreateResponse['session']> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, name }),
    });

    if (!response.ok) {
      throw new Error(`Fork failed: ${response.status}`);
    }

    const data = await response.json();
    return data.session;
  }

  async resumeSession(sessionId: string, messageId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    });

    if (!response.ok) {
      throw new Error(`Resume failed: ${response.status}`);
    }
  }

  async *streamChat(sessionId: string, message: string): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
}

export const apiClient = new ApiClient();

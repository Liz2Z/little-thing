import { createApiClient, type SessionsGetResponse, type SessionsListResponse, type SessionsCreateResponse } from '@littlething/sdk';

export type { Session, Message, SessionDetail } from './types';

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

  async getSession(id: string): Promise<SessionsGetResponse['session']> {
    const { session } = await this.client.sessions.get(id);
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    await this.client.sessions.delete(id);
  }

  async renameSession(id: string, name: string): Promise<void> {
    await this.client.sessions.rename(id, { name });
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

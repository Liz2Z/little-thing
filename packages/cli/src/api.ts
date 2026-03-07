import { createApiClient, type SessionsGetResponse, type SessionsListResponse } from '@littlething/sdk';

export type Message = SessionsGetResponse['session']['messages'][number];
export type SessionMeta = SessionsListResponse['sessions'][number];
export type Session = SessionsGetResponse['session'];

export interface CliConfig {
  serverUrl: string;
}

export class ApiClient {
  private client: ReturnType<typeof createApiClient>;
  private baseUrl: string;

  constructor(config: CliConfig) {
    this.baseUrl = config.serverUrl;
    this.client = createApiClient({ baseUrl: config.serverUrl });
  }

  async listSessions(): Promise<SessionMeta[]> {
    const { sessions } = await this.client.sessions.list();
    return sessions;
  }

  async createSession(name?: string): Promise<SessionMeta> {
    const { session } = await this.client.sessions.create({ name });
    return session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const { session } = await this.client.sessions.get(sessionId);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.client.sessions.delete(sessionId);
  }

  async renameSession(sessionId: string, name: string): Promise<void> {
    await this.client.sessions.rename(sessionId, { name });
  }

  async addMessage(sessionId: string, message: Omit<Message, 'timestamp'>): Promise<void> {
    await this.client.sessions.messages.add(sessionId, {
      role: message.role,
      content: message.content,
    });
  }

  async chatInSession(sessionId: string, message: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  async *streamChatInSession(sessionId: string, message: string): AsyncGenerator<string> {
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

  async health(): Promise<{ status: string; model: string }> {
    return this.client.health.check();
  }
}

import type { Session, SessionDetail } from './types';

export type { Session, Message, SessionDetail } from './types';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getSessions(): Promise<Session[]> {
    const response = await fetch(`${this.baseUrl}/sessions`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    const data = await response.json();
    return data.sessions;
  }

  async createSession(name?: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create session');
    const data = await response.json();
    return data.session;
  }

  async getSession(id: string): Promise<SessionDetail> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`);
    if (!response.ok) throw new Error('Failed to fetch session');
    const data = await response.json();
    return data.session;
  }

  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete session');
  }

  async renameSession(id: string, name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to rename session');
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

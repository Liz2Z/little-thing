import { ApiClient as SdkClient, type paths } from '@agent/sdk';

export type Message = paths['/sessions/{id}']['get']['responses']['200']['content']['application/json']['session']['messages'][number];
export type SessionMeta = paths['/sessions']['get']['responses']['200']['content']['application/json']['sessions'][number];
export type Session = paths['/sessions/{id}']['get']['responses']['200']['content']['application/json']['session'];

export interface CliConfig {
  serverUrl: string;
}

export class ApiClient {
  private client: SdkClient;

  constructor(config: CliConfig) {
    this.client = new SdkClient({ baseUrl: config.serverUrl });
  }

  async listSessions(): Promise<SessionMeta[]> {
    const { data, error } = await this.client.listSessions();
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
    return data.sessions;
  }

  async createSession(name?: string): Promise<SessionMeta> {
    const { data, error } = await this.client.createSession(name);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
    return data.session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const { data, error } = await this.client.getSession(sessionId);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
    return data.session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.client.deleteSession(sessionId);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
  }

  async renameSession(sessionId: string, name: string): Promise<void> {
    const { error } = await this.client.renameSession(sessionId, name);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
  }

  async addMessage(sessionId: string, message: Omit<Message, 'timestamp'>): Promise<void> {
    const { error } = await this.client.addMessage(sessionId, message);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
  }

  async chatInSession(sessionId: string, message: string): Promise<string> {
    const { data, error } = await this.client.chat(sessionId, message);
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
    return data.response;
  }

  async *streamChatInSession(sessionId: string, message: string): AsyncGenerator<string> {
    yield* this.client.streamChat(sessionId, message);
  }

  async health(): Promise<{ status: string; model: string }> {
    const { data, error } = await this.client.health();
    if (error) throw new Error(`API error: ${JSON.stringify(error)}`);
    return data;
  }
}

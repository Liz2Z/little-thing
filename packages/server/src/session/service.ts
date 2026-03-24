import { SessionStore } from './store.js';
import type { Session, SessionMeta, Message } from './types.js';
import { Agent } from '../agent/agent.js';
import { AgentEventType, EventStatus, AgentErrorType } from '../agent/types.js';
import type { AgentEvent } from '../agent/types.js';

export interface ChatOptions {
  enabledTools?: string[];
  maxIterations?: number;
}

export class SessionService {
  constructor(
    private sessionStore: SessionStore,
    private agent: Agent
  ) {}

  listSessions(): SessionMeta[] {
    return this.sessionStore.listSessions();
  }

  getSession(id: string): Session | null {
    return this.sessionStore.getSession(id);
  }

  createSession(name?: string, provider?: string, model?: string): SessionMeta {
    return this.sessionStore.createSession(name, provider, model);
  }

  deleteSession(id: string): boolean {
    return this.sessionStore.deleteSession(id);
  }

  renameSession(id: string, name: string): boolean {
    return this.sessionStore.renameSession(id, name);
  }

  addMessage(sessionId: string, message: Omit<Message, 'id'>): boolean {
    return this.sessionStore.addMessage(sessionId, message);
  }

  forkSession(sessionId: string, messageId: string, name?: string): SessionMeta | null {
    return this.sessionStore.forkSession(sessionId, messageId, name);
  }

  resumeSession(sessionId: string, messageId: string): boolean {
    return this.sessionStore.resumeSession(sessionId, messageId);
  }

  abort(runId: string): void {
    this.agent.abort(runId);
  }

  async *chat(
    sessionId: string,
    message: string,
    options?: ChatOptions
  ): AsyncGenerator<AgentEvent> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      yield {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: 'Session not found',
        error_type: AgentErrorType.Unknown,
        run_id: '',
        seq: 0,
        span_id: '',
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      } as AgentEvent;
      return;
    }

    try {
      for await (const event of this.agent.run(message, session.messages, {
        enabledTools: options?.enabledTools,
        maxIterations: options?.maxIterations,
      })) {
        yield event;

        if (event.type === AgentEventType.Complete || event.type === AgentEventType.Error) {
          this.sessionStore.addMessage(sessionId, {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
          });
          if (event.type === AgentEventType.Complete) {
            this.sessionStore.addMessage(sessionId, {
              role: 'assistant',
              content: event.final_content,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      yield {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: error instanceof Error ? error.message : 'Unknown error',
        error_type: AgentErrorType.Unknown,
        run_id: '',
        seq: 0,
        span_id: '',
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      } as AgentEvent;
    }
  }
}


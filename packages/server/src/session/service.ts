import { SessionStore } from './store.js';
import type { Session, SessionMeta } from './session.schema.js';
import type { Message } from './message.js';
import { Agent } from '../agent/agent.js';
import type {
  AgentEvent,
  AgentErrorEvent,
  AgentCompleteEvent,
} from '../agent/agent-events.schema.js';
import type { ToolExecutor } from '../tools/registry.js';
import type { LanguageModel } from 'ai';
import { createModel } from '../providers/factory.js';

export interface ChatOptions {
  enabledTools?: string[];
  provider?: string;
  model?: string;
}

export class SessionService {
  constructor(
    private sessionStore: SessionStore,
    private toolExecutor: ToolExecutor,
  ) {}

  private createAgent(provider: string, model: string): Agent {
    const languageModel = createModel(provider, model);
    return new Agent(languageModel, this.toolExecutor);
  }

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
  }

  async *chat(
    sessionId: string,
    message: string,
    options?: ChatOptions
  ): AsyncGenerator<AgentEvent> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      const errorEvent: AgentErrorEvent = {
        type: 'agent_error',
        status: 'failed',
        error: 'Session not found',
        error_type: 'unknown',
        run_id: '',
        seq: 0,
        span_id: '',
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      };
      yield errorEvent;
      return;
    }

    const provider = options?.provider || session.meta.provider ;
    const model = options?.model || session.meta.model ;

    if (!provider || !model) {
      throw new Error('Provider and model are required');
    }

    try {
      const agent = this.createAgent(provider, model);

      for await (const event of agent.run(message, session.messages, {
        enabledTools: options?.enabledTools,
      })) {
        yield event;

        if (event.type === 'agent_complete' || event.type === 'agent_error') {
          this.sessionStore.addMessage(sessionId, {
            role: 'user',
            content: { type: 'text', text: message },
            timestamp: new Date().toISOString(),
          });
          if (event.type === 'agent_complete') {
            this.sessionStore.addMessage(sessionId, {
              role: 'assistant',
              content: { type: 'text', text: (event as AgentCompleteEvent).final_content },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      const errorEvent: AgentErrorEvent = {
        type: 'agent_error',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        error_type: 'unknown',
        run_id: '',
        seq: 0,
        span_id: '',
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      };
      yield errorEvent;
    }
  }
}

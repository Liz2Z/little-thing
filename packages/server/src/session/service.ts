import { SessionStore } from './store.js';
import type { Session, SessionMeta, Message } from './types.js';
import { Agent } from '../agent/agent.js';
import { AgentEventType, EventStatus, AgentErrorType } from '../agent/types.js';
import type { AgentEvent } from '../agent/types.js';
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
    // Agent 实例是动态创建的，暂时不支持 abort
    // TODO: 可以通过维护活跃 Agent 映射来实现
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

    // 使用会话配置的 provider 和 model，或者使用选项中提供的
    const provider = options?.provider || session.meta.provider || 'anthropic';
    const model = options?.model || session.meta.model || 'claude-3-5-sonnet-20241022';

    try {
      // 动态创建 Agent
      const agent = this.createAgent(provider, model);

      for await (const event of agent.run(message, session.messages, {
        enabledTools: options?.enabledTools,
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


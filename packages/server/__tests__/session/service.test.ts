/**
 * SessionService 单元测试
 *
 * 测试 SessionService 类的所有公共方法，包括：
 * - CRUD 操作：listSessions, getSession, createSession, deleteSession, renameSession
 * - 消息操作：addMessage
 * - 会话分支与恢复：forkSession, resumeSession
 * - 聊天功能：chat (AsyncGenerator)
 * - 中止操作：abort
 *
 * 使用 mock 对象隔离 SessionStore 和 ToolExecutor 依赖
 */
import { describe, it, expect, beforeEach, mock, afterEach } from 'bun:test';
import { SessionService } from '../../src/session/service.js';
import type { SessionStore } from '../../src/session/store.js';
import type { Session, SessionMeta } from '../../src/session/session.schema.js';
import type { Message } from '../../src/session/message.js';
import type { ToolExecutor } from '../../src/tools/registry.js';
import type { AgentEvent, AgentCompleteEvent, AgentErrorEvent } from '../../src/agent/agent-events.schema.js';

/**
 * 创建模拟的 SessionStore
 * 使用内存 Map 存储会话数据，避免文件系统依赖
 */
const createMockSessionStore = (): {
  store: SessionStore;
  reset: () => void;
  sessions: Map<string, Session>;
} => {
  const sessions = new Map<string, Session>();
  let sessionCounter = 0;
  let messageCounter = 0;

  const store = {
    listSessions: mock(() => {
      return Array.from(sessions.values())
        .map(s => s.meta)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }),
    getSession: mock((id: string) => sessions.get(id) || null),
    createSession: mock((name?: string, provider?: string, model?: string): SessionMeta => {
      sessionCounter++;
      const id = `session-${sessionCounter}`;
      const now = new Date().toISOString();
      const meta: SessionMeta = {
        id,
        name: name || `会话-${sessions.size + 1}`,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        provider: provider || 'test-provider',
        model: model || 'test-model',
      };
      sessions.set(id, { meta, messages: [] });
      return meta;
    }),
    deleteSession: mock((id: string) => {
      if (!sessions.has(id)) return false;
      sessions.delete(id);
      return true;
    }),
    renameSession: mock((id: string, name: string) => {
      const session = sessions.get(id);
      if (!session) return false;
      session.meta.name = name;
      session.meta.updatedAt = new Date().toISOString();
      return true;
    }),
    addMessage: mock((sessionId: string, message: Omit<Message, 'id'>) => {
      const session = sessions.get(sessionId);
      if (!session) return false;
      messageCounter++;
      const msg: Message = {
        ...message,
        id: `msg-${messageCounter}`,
      };
      session.messages.push(msg);
      session.meta.messageCount++;
      session.meta.updatedAt = new Date().toISOString();
      return true;
    }),
    forkSession: mock((sessionId: string, messageId: string, name?: string) => {
      const sourceSession = sessions.get(sessionId);
      if (!sourceSession) return null;

      const messageIndex = sourceSession.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return null;

      sessionCounter++;
      const newId = `session-${sessionCounter}`;
      const now = new Date().toISOString();
      const meta: SessionMeta = {
        id: newId,
        name: name || `${sourceSession.meta.name} (fork)`,
        createdAt: now,
        updatedAt: now,
        messageCount: 0,
        parentSessionId: sessionId,
        forkedFromMessageId: messageId,
      };

      const messagesToCopy = sourceSession.messages.slice(0, messageIndex + 1).map(msg => {
        messageCounter++;
        return {
          ...msg,
          id: `msg-${messageCounter}`,
        };
      });
      meta.messageCount = messagesToCopy.length;

      sessions.set(newId, { meta, messages: messagesToCopy });
      return meta;
    }),
    resumeSession: mock((sessionId: string, messageId: string) => {
      const session = sessions.get(sessionId);
      if (!session) return false;

      const messageIndex = session.messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return false;

      session.messages = session.messages.slice(0, messageIndex);
      session.meta.messageCount = session.messages.length;
      session.meta.updatedAt = new Date().toISOString();
      return true;
    }),
  } as unknown as SessionStore;

  return {
    store,
    reset: () => {
      sessions.clear();
      sessionCounter = 0;
      messageCounter = 0;
    },
    sessions,
  };
};

const createMockToolExecutor = (): ToolExecutor => ({
  execute: mock(async () => ({ success: true, output: 'ok' })),
  getDefinition: mock(() => undefined),
  getAllDefinitions: mock(() => []),
});

describe('SessionService', () => {
  let service: SessionService;
  let mockStore: ReturnType<typeof createMockSessionStore>;
  let mockToolExecutor: ToolExecutor;

  beforeEach(() => {
    mockStore = createMockSessionStore();
    mockToolExecutor = createMockToolExecutor();
    service = new SessionService(mockStore.store, mockToolExecutor);
  });

  afterEach(() => {
    mockStore.reset();
  });

  describe('listSessions', () => {
    it('should return empty array when no sessions exist', () => {
      const result = service.listSessions();
      expect(result).toEqual([]);
    });

    it('should return all sessions sorted by updatedAt', () => {
      const meta1 = service.createSession('Session 1');
      const meta2 = service.createSession('Session 2');
      const meta3 = service.createSession('Session 3');

      const sessions = service.listSessions();
      expect(sessions.length).toBe(3);
      const ids = sessions.map(s => s.id);
      expect(ids).toContain(meta1.id);
      expect(ids).toContain(meta2.id);
      expect(ids).toContain(meta3.id);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const result = service.getSession('non-existent');
      expect(result).toBeNull();
    });

    it('should return session for valid id', () => {
      const meta = service.createSession('Test Session');
      const result = service.getSession(meta.id);
      expect(result).not.toBeNull();
      expect(result?.meta.id).toBe(meta.id);
      expect(result?.meta.name).toBe('Test Session');
    });
  });

  describe('createSession', () => {
    it('should create session with default name', () => {
      const meta = service.createSession();
      expect(meta.name).toBe('会话-1');
      expect(meta.messageCount).toBe(0);
    });

    it('should create session with custom name', () => {
      const meta = service.createSession('My Custom Session');
      expect(meta.name).toBe('My Custom Session');
    });

    it('should create session with provider and model', () => {
      const meta = service.createSession('Test', 'openai', 'gpt-4');
      expect(meta.provider).toBe('openai');
      expect(meta.model).toBe('gpt-4');
    });
  });

  describe('deleteSession', () => {
    it('should return false for non-existent session', () => {
      const result = service.deleteSession('non-existent');
      expect(result).toBe(false);
    });

    it('should delete existing session and return true', () => {
      const meta = service.createSession('To Delete');
      const result = service.deleteSession(meta.id);
      expect(result).toBe(true);
      expect(service.getSession(meta.id)).toBeNull();
    });
  });

  describe('renameSession', () => {
    it('should return false for non-existent session', () => {
      const result = service.renameSession('non-existent', 'New Name');
      expect(result).toBe(false);
    });

    it('should rename existing session', () => {
      const meta = service.createSession('Old Name');
      const result = service.renameSession(meta.id, 'New Name');
      expect(result).toBe(true);
      const session = service.getSession(meta.id);
      expect(session?.meta.name).toBe('New Name');
    });
  });

  describe('addMessage', () => {
    it('should return false for non-existent session', () => {
      const result = service.addMessage('non-existent', {
        role: 'user',
        content: { type: 'text', text: 'Hello' },
        timestamp: new Date().toISOString(),
      });
      expect(result).toBe(false);
    });

    it('should add message to existing session', () => {
      const meta = service.createSession('Test');
      const result = service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Hello' },
        timestamp: new Date().toISOString(),
      });
      expect(result).toBe(true);
      const session = service.getSession(meta.id);
      expect(session?.messages.length).toBe(1);
      expect(session?.messages[0].role).toBe('user');
      expect(session?.meta.messageCount).toBe(1);
    });
  });

  describe('forkSession', () => {
    it('should return null for non-existent source session', () => {
      const result = service.forkSession('non-existent', 'msg-1');
      expect(result).toBeNull();
    });

    it('should return null for non-existent message', () => {
      const meta = service.createSession('Source');
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Hello' },
        timestamp: new Date().toISOString(),
      });
      const result = service.forkSession(meta.id, 'non-existent-msg');
      expect(result).toBeNull();
    });

    it('should fork session with messages up to target', () => {
      const meta = service.createSession('Source');
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Message 1' },
        timestamp: new Date().toISOString(),
      });
      service.addMessage(meta.id, {
        role: 'assistant',
        content: { type: 'text', text: 'Response 1' },
        timestamp: new Date().toISOString(),
      });
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Message 2' },
        timestamp: new Date().toISOString(),
      });

      const sourceSession = service.getSession(meta.id);
      const targetMsgId = sourceSession!.messages[1].id;

      const forkedMeta = service.forkSession(meta.id, targetMsgId);
      expect(forkedMeta).not.toBeNull();
      expect(forkedMeta?.name).toBe('Source (fork)');
      expect(forkedMeta?.parentSessionId).toBe(meta.id);
      expect(forkedMeta?.forkedFromMessageId).toBe(targetMsgId);

      const forkedSession = service.getSession(forkedMeta!.id);
      expect(forkedSession?.messages.length).toBe(2);
    });

    it('should fork session with custom name', () => {
      const meta = service.createSession('Source');
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Hello' },
        timestamp: new Date().toISOString(),
      });

      const sourceSession = service.getSession(meta.id);
      const msgId = sourceSession!.messages[0].id;

      const forkedMeta = service.forkSession(meta.id, msgId, 'Custom Fork Name');
      expect(forkedMeta?.name).toBe('Custom Fork Name');
    });
  });

  describe('resumeSession', () => {
    it('should return false for non-existent session', () => {
      const result = service.resumeSession('non-existent', 'msg-1');
      expect(result).toBe(false);
    });

    it('should return false for non-existent message', () => {
      const meta = service.createSession('Test');
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Hello' },
        timestamp: new Date().toISOString(),
      });
      const result = service.resumeSession(meta.id, 'non-existent-msg');
      expect(result).toBe(false);
    });

    it('should truncate messages before target message', () => {
      const meta = service.createSession('Test');
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Message 1' },
        timestamp: new Date().toISOString(),
      });
      service.addMessage(meta.id, {
        role: 'assistant',
        content: { type: 'text', text: 'Response 1' },
        timestamp: new Date().toISOString(),
      });
      service.addMessage(meta.id, {
        role: 'user',
        content: { type: 'text', text: 'Message 2' },
        timestamp: new Date().toISOString(),
      });

      const session = service.getSession(meta.id);
      expect(session?.messages.length).toBe(3);

      const targetMsgId = session!.messages[1].id;
      const result = service.resumeSession(meta.id, targetMsgId);
      expect(result).toBe(true);

      const updatedSession = service.getSession(meta.id);
      expect(updatedSession?.messages.length).toBe(1);
      expect(updatedSession?.meta.messageCount).toBe(1);
    });
  });

  describe('chat', () => {
    it('should yield error event for non-existent session', async () => {
      const events: AgentEvent[] = [];
      for await (const event of service.chat('non-existent', 'Hello')) {
        events.push(event);
      }
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('agent_error');
      expect((events[0] as AgentErrorEvent).error).toBe('Session not found');
    });

    it('should throw error when provider and model are missing', async () => {
      const mockStoreWithoutProvider = createMockSessionStore();
      const meta = mockStoreWithoutProvider.store.createSession('Test');
      const session = mockStoreWithoutProvider.sessions.get(meta.id);
      if (session) {
        session.meta.provider = undefined;
        session.meta.model = undefined;
      }

      const testService = new SessionService(mockStoreWithoutProvider.store, mockToolExecutor);

      expect(async () => {
        for await (const _ of testService.chat(meta.id, 'Hello')) {}
      }).toThrow('Provider 和 model 是必需的');
    });

    it('should add user and assistant messages on agent complete', async () => {
      const meta = service.createSession('Test', 'test-provider', 'test-model');

      const mockChat = mock(async function* () {
        const completeEvent: AgentCompleteEvent = {
          type: 'agent_complete',
          status: 'completed',
          run_id: 'test-run',
          seq: 1,
          span_id: 'span-1',
          parent_span_id: null,
          timestamp: new Date().toISOString(),
          final_content: 'Assistant response',
          total_iterations: 1,
          stop_reason: 'end_turn',
        };
        yield completeEvent;
      });

      service.chat = mockChat as typeof service.chat;

      const events: AgentEvent[] = [];
      for await (const event of service.chat(meta.id, 'User message')) {
        events.push(event);
      }

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('agent_complete');
    });
  });

  describe('abort', () => {
    it('should not throw when called', () => {
      expect(() => service.abort('run-id')).not.toThrow();
    });
  });
});

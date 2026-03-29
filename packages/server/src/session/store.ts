import { JsonStore, JsonlStore } from '../storage/index.js';
import type { SessionMeta, SessionIndex, Session } from './session.schema.js';
import type { Message } from './message.js';
import { settings } from '../settings';

function generateId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}-${random}`;
}

function generateMessageId(): string {
  return `msg_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class SessionStore {
  private indexStore: JsonStore<SessionIndex>;
  private messageStores: Map<string, JsonlStore<Message>> = new Map();

  constructor() {
    this.indexStore = new JsonStore<SessionIndex>(
      'index.json',
      { sessions: {} },
      { category: 'data', subDir: 'sessions' }
    );
  }

  private getMessageStore(sessionId: string): JsonlStore<Message> {
    if (!this.messageStores.has(sessionId)) {
      this.messageStores.set(
        sessionId,
        new JsonlStore<Message>(`${sessionId}.jsonl`, {
          category: 'data',
          subDir: 'sessions',
        })
      );
    }
    return this.messageStores.get(sessionId)!;
  }

  getSession(sessionId: string): Session | null {
    const index = this.indexStore.load();
    const meta = index.sessions[sessionId];
    if (!meta) return null;
    const messages = this.getMessageStore(sessionId).loadAll();
    return { meta, messages };
  }

  listSessions(): SessionMeta[] {
    const index = this.indexStore.load();
    return Object.values(index.sessions).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  createSession(name?: string, provider?: string, model?: string): SessionMeta {
    const index = this.indexStore.load();
    const id = generateId();
    const now = new Date().toISOString();
    const sessionName = name || `会话-${Object.keys(index.sessions).length + 1}`;
    const llm = settings.llm.get();

    const meta: SessionMeta = {
      id,
      name: sessionName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      provider: provider || llm.provider,
      model: model || llm.model,
    };

    index.sessions[id] = meta;
    this.indexStore.save(index);

    return meta;
  }

  addMessage(sessionId: string, message: Omit<Message, 'id'>): boolean {
    const index = this.indexStore.load();
    const meta = index.sessions[sessionId];
    if (!meta) return false;

    const messageWithId: Message = {
      ...message,
      id: generateMessageId(),
    };
    this.getMessageStore(sessionId).append(messageWithId);

    meta.messageCount++;
    meta.updatedAt = new Date().toISOString();
    this.indexStore.save(index);

    return true;
  }

  deleteSession(sessionId: string): boolean {
    const index = this.indexStore.load();
    if (!index.sessions[sessionId]) {
      return false;
    }

    delete index.sessions[sessionId];
    this.indexStore.save(index);

    this.getMessageStore(sessionId).delete();
    this.messageStores.delete(sessionId);

    return true;
  }

  renameSession(sessionId: string, newName: string): boolean {
    const index = this.indexStore.load();
    const meta = index.sessions[sessionId];
    if (!meta) return false;

    meta.name = newName;
    meta.updatedAt = new Date().toISOString();
    this.indexStore.save(index);

    return true;
  }

  forkSession(sourceSessionId: string, messageId: string, name?: string): SessionMeta | null {
    const sourceSession = this.getSession(sourceSessionId);
    if (!sourceSession) return null;

    const messageIndex = sourceSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;

    const index = this.indexStore.load();
    const newId = generateId();
    const now = new Date().toISOString();
    const forkName = name || `${sourceSession.meta.name} (fork)`;

    const meta: SessionMeta = {
      id: newId,
      name: forkName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      parentSessionId: sourceSessionId,
      forkedFromMessageId: messageId,
    };

    index.sessions[newId] = meta;
    this.indexStore.save(index);

    const messagesToCopy = sourceSession.messages.slice(0, messageIndex + 1);
    const messageStore = this.getMessageStore(newId);
    for (const msg of messagesToCopy) {
      const newMessage: Message = {
        ...msg,
        id: generateMessageId(),
      };
      messageStore.append(newMessage);
      meta.messageCount++;
    }

    this.indexStore.save(index);

    return meta;
  }

  resumeSession(sessionId: string, messageId: string): boolean {
    const session = this.getSession(sessionId);
    if (!session) return false;

    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;

    const index = this.indexStore.load();
    const meta = index.sessions[sessionId];
    if (!meta) return false;

    // Keep only messages before the target message (exclude the target message)
    const keepCount = messageIndex;
    this.getMessageStore(sessionId).truncate(keepCount);

    meta.messageCount = keepCount;
    meta.updatedAt = new Date().toISOString();
    this.indexStore.save(index);

    return true;
  }
}

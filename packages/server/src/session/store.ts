import { JsonStore, JsonlStore } from '../storage/index.js';
import type { Message, SessionMeta, SessionIndex, Session } from './types.js';

function generateId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}-${random}`;
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

  createSession(name?: string): SessionMeta {
    const index = this.indexStore.load();
    const id = generateId();
    const now = new Date().toISOString();
    const sessionName = name || `会话-${Object.keys(index.sessions).length + 1}`;

    const meta: SessionMeta = {
      id,
      name: sessionName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    index.sessions[id] = meta;
    this.indexStore.save(index);

    return meta;
  }

  addMessage(sessionId: string, message: Message): boolean {
    const index = this.indexStore.load();
    const meta = index.sessions[sessionId];
    if (!meta) return false;

    this.getMessageStore(sessionId).append(message);

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
}

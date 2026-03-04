import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Message, SessionMeta, SessionIndex, Session } from './types.js';

const DATA_DIR = join(homedir(), '.local', 'share', 'agent-cli', 'sessions');
const INDEX_FILE = join(DATA_DIR, 'index.json');

function generateId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}-${random}`;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getSessionFilePath(sessionId: string): string {
  return join(DATA_DIR, `${sessionId}.jsonl`);
}

export class SessionStore {
  private index: SessionIndex;

  constructor() {
    ensureDataDir();
    this.index = this.loadIndex();
  }

  private loadIndex(): SessionIndex {
    if (!existsSync(INDEX_FILE)) {
      return { sessions: {} };
    }
    try {
      const content = readFileSync(INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { sessions: {} };
    }
  }

  private saveIndex(): void {
    writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2));
  }

  private loadMessages(sessionId: string): Message[] {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath)) {
      return [];
    }
    try {
      const content = readFileSync(filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private appendMessage(sessionId: string, message: Message): void {
    const filePath = getSessionFilePath(sessionId);
    const line = JSON.stringify(message) + '\n';
    appendFileSync(filePath, line);
  }

  getSession(sessionId: string): Session | null {
    const meta = this.index.sessions[sessionId];
    if (!meta) return null;
    const messages = this.loadMessages(sessionId);
    return { meta, messages };
  }

  listSessions(): SessionMeta[] {
    return Object.values(this.index.sessions).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  createSession(name?: string): SessionMeta {
    const id = generateId();
    const now = new Date().toISOString();
    const sessionName = name || `会话-${Object.keys(this.index.sessions).length + 1}`;

    const meta: SessionMeta = {
      id,
      name: sessionName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    this.index.sessions[id] = meta;
    this.saveIndex();

    return meta;
  }

  addMessage(sessionId: string, message: Message): boolean {
    const meta = this.index.sessions[sessionId];
    if (!meta) return false;

    this.appendMessage(sessionId, message);
    meta.messageCount++;
    meta.updatedAt = new Date().toISOString();
    this.saveIndex();
    return true;
  }

  deleteSession(sessionId: string): boolean {
    if (!this.index.sessions[sessionId]) {
      return false;
    }

    delete this.index.sessions[sessionId];
    this.saveIndex();

    const filePath = getSessionFilePath(sessionId);
    try {
      unlinkSync(filePath);
    } catch {
      // Ignore delete errors
    }

    return true;
  }

  renameSession(sessionId: string, newName: string): boolean {
    const meta = this.index.sessions[sessionId];
    if (!meta) return false;

    meta.name = newName;
    meta.updatedAt = new Date().toISOString();
    this.saveIndex();
    return true;
  }
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  systemPrompt?: string;
}

export interface SessionIndex {
  sessions: Record<string, SessionMeta>;
}

export interface Session {
  meta: SessionMeta;
  messages: Message[];
}

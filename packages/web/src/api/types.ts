import type { SessionsListResponse } from '@littlething/sdk';

// Extended Message type with id field
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export type Session = SessionsListResponse['sessions'][number];
export type SessionDetail = {
  meta: Session;
  messages: Message[];
};

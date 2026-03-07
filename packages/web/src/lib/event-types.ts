/**
 * 事件类型定义
 * 与服务器端事件类型保持同步
 */

export const EventType = {
  SESSION_CREATED: 'session:created',
  SESSION_DELETED: 'session:deleted',
  SESSION_UPDATED: 'session:updated',
  MESSAGE_RECEIVED: 'message:received',
  CHAT_STREAM: 'chat:stream',
  CHAT_COMPLETE: 'chat:complete',
  ERROR: 'error',
} as const;

export type EventType = typeof EventType[keyof typeof EventType];

export interface Event<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: string;
  sessionId?: string;
}

export interface SessionCreatedPayload {
  sessionId: string;
  name: string;
  createdAt: string;
}

export interface SessionDeletedPayload {
  sessionId: string;
}

export interface SessionUpdatedPayload {
  sessionId: string;
  name?: string;
  updatedAt: string;
}

export interface MessageReceivedPayload {
  sessionId: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatStreamPayload {
  sessionId: string;
  delta: string;
  done: boolean;
}

export interface ChatCompletePayload {
  sessionId: string;
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ErrorPayload {
  code?: string;
  message: string;
  sessionId?: string;
}

export interface EventMap {
  [EventType.SESSION_CREATED]: SessionCreatedPayload;
  [EventType.SESSION_DELETED]: SessionDeletedPayload;
  [EventType.SESSION_UPDATED]: SessionUpdatedPayload;
  [EventType.MESSAGE_RECEIVED]: MessageReceivedPayload;
  [EventType.CHAT_STREAM]: ChatStreamPayload;
  [EventType.CHAT_COMPLETE]: ChatCompletePayload;
  [EventType.ERROR]: ErrorPayload;
}

export type TypedEvent<K extends EventType = EventType> = Event<EventMap[K]>;

/**
 * 事件总线实现
 * 基于发布-订阅模式的事件总线，支持类型安全的事件订阅和发布
 */

import { EventType, type Event, type EventMap, type TypedEvent } from './types.js';

type EventCallback<T extends Event> = (event: T) => void;
type AllEventCallback = (event: Event) => void;

export class EventBus {
  private subscribers: Map<EventType, Set<EventCallback<Event>>> = new Map();
  private allSubscribers: Set<AllEventCallback> = new Set();

  subscribe<K extends EventType>(
    eventType: K,
    callback: EventCallback<TypedEvent<K>>
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const callbacks = this.subscribers.get(eventType)!;
    callbacks.add(callback as EventCallback<Event>);

    return () => {
      this.unsubscribe(eventType, callback);
    };
  }

  unsubscribe<K extends EventType>(
    eventType: K,
    callback: EventCallback<TypedEvent<K>>
  ): void {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.delete(callback as EventCallback<Event>);
      if (callbacks.size === 0) {
        this.subscribers.delete(eventType);
      }
    }
  }

  publish<K extends EventType>(event: TypedEvent<K>): void {
    const callbacks = this.subscribers.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`事件处理器执行错误 [${event.type}]:`, error);
        }
      });
    }

    this.allSubscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error(`全局事件处理器执行错误 [${event.type}]:`, error);
      }
    });
  }

  subscribeAll(callback: AllEventCallback): () => void {
    this.allSubscribers.add(callback);
    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  clear(): void {
    this.subscribers.clear();
    this.allSubscribers.clear();
  }

  getSubscriberCount(eventType: EventType): number {
    return this.subscribers.get(eventType)?.size ?? 0;
  }
}

export const eventBus = new EventBus();

export function createEvent<K extends EventType>(
  type: K,
  payload: EventMap[K],
  sessionId?: string
): TypedEvent<K> {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
    sessionId,
  };
}

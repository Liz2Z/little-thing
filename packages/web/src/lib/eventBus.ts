/**
 * 事件总线
 * 用于组件间的事件通信
 */

type EventCallback<T = unknown> = (payload: T) => void;

export class EventBus<EventMap> {
  private subscribers: Map<string | number | symbol, Set<EventCallback<unknown>>> = new Map();
  private allSubscribers: Set<EventCallback<unknown>> = new Set();

  emit<K extends keyof EventMap>(eventType: K, payload: EventMap[K]): void {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      callbacks.forEach(cb => cb(payload));
    }
    this.allSubscribers.forEach(cb => cb(payload));
  }

  on<K extends keyof EventMap>(eventType: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(callback as EventCallback<unknown>);
    
    return () => {
      this.subscribers.get(eventType)?.delete(callback as EventCallback<unknown>);
    };
  }

  onAll(callback: EventCallback<unknown>): () => void {
    this.allSubscribers.add(callback);
    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  clear(): void {
    this.subscribers.clear();
    this.allSubscribers.clear();
  }
}

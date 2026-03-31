/**
 * SSE 事件客户端
 * 用于接收服务器推送的实时事件
 */

import {
  type Event,
  type EventMap,
  EventType,
  type TypedEvent,
} from "./event-types.js";

export type { Event, EventMap, EventType, TypedEvent };

export interface SSEClientOptions {
  baseUrl?: string;
  sessionId?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export type EventCallback = (event: TypedEvent) => void;

export class SSEClient {
  private baseUrl: string;
  private sessionId?: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private eventSource: EventSource | null = null;
  private subscribers: Map<EventType, Set<EventCallback>> = new Map();
  private allSubscribers: Set<EventCallback> = new Set();
  private reconnectAttempts = 0;
  private isConnecting = false;
  private shouldReconnect = true;

  constructor(options: SSEClientOptions = {}) {
    this.baseUrl = options.baseUrl || "http://localhost:3000";
    this.sessionId = options.sessionId;
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || this.eventSource) {
        resolve();
        return;
      }

      this.isConnecting = true;
      this.shouldReconnect = true;

      let url = `${this.baseUrl}/events`;
      if (this.sessionId) {
        url += `?sessionId=${this.sessionId}`;
      }

      const es = new EventSource(url);
      this.eventSource = es;

      es.onopen = () => {
        console.log("SSE 连接已建立");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        resolve();
      };

      es.onerror = () => {
        console.error("SSE 连接错误");
        this.isConnecting = false;

        if (
          this.shouldReconnect &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
          );
          setTimeout(() => {
            this.disconnect();
            this.connect();
          }, this.reconnectInterval);
        } else {
          reject(new Error("SSE 连接失败"));
        }
      };

      es.addEventListener("connected", ((event: MessageEvent) => {
        console.log("SSE 已连接:", event.data);
      }) as EventListener);

      es.addEventListener("heartbeat", (() => {}) as EventListener);

      for (const eventType of Object.values(EventType)) {
        es.addEventListener(eventType, ((event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data) as TypedEvent;
            this.dispatchEvent(data);
          } catch (error) {
            console.error("解析事件数据失败:", error);
          }
        }) as EventListener);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    console.log("SSE 连接已断开");
  }

  subscribe<K extends keyof EventMap>(
    eventType: K,
    callback: (event: TypedEvent<K>) => void,
  ): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    const callbacks = this.subscribers.get(eventType)!;
    callbacks.add(callback as EventCallback);

    return () => {
      callbacks.delete(callback as EventCallback);
      if (callbacks.size === 0) {
        this.subscribers.delete(eventType);
      }
    };
  }

  subscribeAll(callback: EventCallback): () => void {
    this.allSubscribers.add(callback);
    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  private dispatchEvent(event: TypedEvent): void {
    const callbacks = this.subscribers.get(event.type);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error("事件处理错误:", error);
        }
      });
    }

    this.allSubscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("全局事件处理错误:", error);
      }
    });
  }

  getConnectionStatus(): "connected" | "connecting" | "disconnected" {
    if (this.eventSource?.readyState === 1) {
      return "connected";
    }
    if (this.isConnecting) {
      return "connecting";
    }
    return "disconnected";
  }
}

export const createSSEClient = (options?: SSEClientOptions) =>
  new SSEClient(options);

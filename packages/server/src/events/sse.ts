/**
 * SSE (Server-Sent Events) 端点实现
 * 提供实时事件推送能力
 */

import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eventBus } from './bus.js';
import { EventType, type Event, type TypedEvent } from './types.js';

export interface SSEClient {
  id: string;
  connectedAt: Date;
  sessionId?: string;
}

const clients = new Map<string, SSEClient>();

export function setupSSE(app: any) {
  app.get('/events', async (c: Context) => {
    const clientId = crypto.randomUUID();
    const sessionId = c.req.query('sessionId');

    clients.set(clientId, {
      id: clientId,
      connectedAt: new Date(),
      sessionId,
    });

    console.log(`SSE 客户端连接: ${clientId}${sessionId ? ` (session: ${sessionId})` : ''}`);

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: 'connected',
        data: JSON.stringify({ clientId, timestamp: new Date().toISOString() }),
      });

      const unsubscribe = eventBus.subscribeAll(async (event: Event) => {
        if (sessionId && event.sessionId && event.sessionId !== sessionId) {
          return;
        }

        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      });

      let heartbeatInterval: ReturnType<typeof setInterval>;
      
      heartbeatInterval = setInterval(async () => {
        try {
          await stream.writeSSE({
            event: 'heartbeat',
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          });
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      try {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } finally {
        clearInterval(heartbeatInterval);
        unsubscribe();
        clients.delete(clientId);
        console.log(`SSE 客户端断开: ${clientId}`);
      }
    });
  });
}

export function broadcastEvent<K extends EventType>(event: TypedEvent<K>) {
  eventBus.publish(event);
}

export function getConnectedClients(): SSEClient[] {
  return Array.from(clients.values());
}

export function getClientCount(): number {
  return clients.size;
}

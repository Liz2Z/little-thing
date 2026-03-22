import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { eventBus } from '../events/bus.js';
import type { Event } from '../events/types.js';

const app = new Hono();

app.get('/health',
  describeRoute({
    operationId: 'health.check',
    summary: '健康检查',
    description: '检查服务是否正常运行',
    tags: ['System'],
    responses: {
      200: {
        description: '服务健康状态',
        content: {
          'application/json': {
            schema: resolver(z.object({
              status: z.string().meta({ description: '服务状态' }),
              model: z.string().meta({ description: '当前使用的模型' }),
            })),
          },
        },
      },
    },
  }),
  (c) => {
    return c.json({ status: 'ok' });
  }
);

app.get('/openapi.json', async (c) => {
  const { generateSpecs } = await import('hono-openapi');
  const specs = await generateSpecs(app);
  return c.json({
    ...specs,
    openapi: '3.1.0',
    info: {
      title: 'Agent Platform API',
      version: '1.0.0',
      description: 'API for Agent Platform - a chat application with session management and real-time events',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  });
});

app.get('/events', async (c) => {
  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: 'connected',
      data: JSON.stringify({ timestamp: new Date().toISOString() }),
    });

    const unsubscribe = eventBus.subscribeAll(async (event: Event) => {
      await stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });

    const heartbeat = setInterval(() => {
      stream.writeSSE({
        data: JSON.stringify({
          type: "server.heartbeat",
          properties: {},
        }),
      })
    }, 10_000)

    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        clearInterval(heartbeat)
        unsubscribe()
        resolve()
      })
    })
  })
});


export const systemRoutes = app;
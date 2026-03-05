/**
 * OpenAPI 路由定义
 * 使用 hono-openapi 实现类型安全的 API 定义
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { describeRoute } from 'hono-openapi';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AnthropicProvider } from './providers/anthropic.js';
import { SessionStore } from './session/store.js';
import type { Message } from './session/types.js';
import { setupSSE, broadcastEvent } from './events/index.js';
import { EventType, createEvent } from './events/index.js';

const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
});

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.string(),
});

const SessionDetailSchema = SessionSchema.extend({
  messages: z.array(MessageSchema),
});

const UsageSchema = z.object({
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const SuccessSchema = z.object({
  success: z.boolean(),
});

const HealthSchema = z.object({
  status: z.string(),
  model: z.string(),
});

const ListSessionsResponseSchema = z.object({
  sessions: z.array(SessionSchema),
});

const CreateSessionRequestSchema = z.object({
  name: z.string().optional(),
});

const CreateSessionResponseSchema = z.object({
  session: SessionSchema,
});

const GetSessionResponseSchema = z.object({
  session: SessionDetailSchema,
});

const RenameSessionRequestSchema = z.object({
  name: z.string(),
});

const AddMessageRequestSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

const ChatRequestSchema = z.object({
  message: z.string(),
});

const ChatResponseSchema = z.object({
  response: z.string(),
  usage: UsageSchema.optional(),
});

const ChatWithoutSessionRequestSchema = z.object({
  messages: z.array(MessageSchema),
});

export function createApp(llmConfig: { apiKey: string; baseUrl: string; model: string }) {
  const app = new Hono();
  const provider = new AnthropicProvider(llmConfig);
  const sessionStore = new SessionStore();

  app.use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }));

  setupSSE(app);

  app.get('/health', 
    describeRoute({
      operationId: 'health.check',
      summary: '健康检查',
      tags: ['System'],
      responses: {
        200: {
          description: '服务健康状态',
        },
      },
    }),
    (c) => {
      return c.json({ status: 'ok', model: llmConfig.model });
    }
  );

  app.get('/sessions',
    describeRoute({
      operationId: 'sessions.list',
      summary: '获取会话列表',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '会话列表',
        },
      },
    }),
    (c) => {
      const sessions = sessionStore.listSessions();
      return c.json({ sessions });
    }
  );

  app.post('/sessions',
    describeRoute({
      operationId: 'sessions.create',
      summary: '创建新会话',
      tags: ['Sessions'],
      responses: {
        201: {
          description: '创建的会话',
        },
      },
    }),
    zValidator('json', CreateSessionRequestSchema),
    (c) => {
      const body = c.req.valid('json');
      const session = sessionStore.createSession(body.name);
      
      broadcastEvent(createEvent(
        EventType.SESSION_CREATED,
        {
          sessionId: session.id,
          name: session.name,
          createdAt: session.createdAt,
        },
        session.id
      ));
      
      return c.json({ session }, 201);
    }
  );

  app.get('/sessions/:id',
    describeRoute({
      operationId: 'sessions.get',
      summary: '获取会话详情',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '会话详情',
        },
        404: {
          description: '会话不存在',
        },
      },
    }),
    (c) => {
      const id = c.req.param('id');
      const session = sessionStore.getSession(id);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }
      return c.json({ session });
    }
  );

  app.delete('/sessions/:id',
    describeRoute({
      operationId: 'sessions.delete',
      summary: '删除会话',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '删除成功',
        },
        404: {
          description: '会话不存在',
        },
      },
    }),
    (c) => {
      const id = c.req.param('id');
      if (sessionStore.deleteSession(id)) {
        broadcastEvent(createEvent(
          EventType.SESSION_DELETED,
          { sessionId: id },
          id
        ));
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.put('/sessions/:id',
    describeRoute({
      operationId: 'sessions.rename',
      summary: '重命名会话',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '重命名成功',
        },
        404: {
          description: '会话不存在',
        },
      },
    }),
    zValidator('json', RenameSessionRequestSchema),
    (c) => {
      const id = c.req.param('id');
      const { name } = c.req.valid('json');
      
      if (sessionStore.renameSession(id, name)) {
        broadcastEvent(createEvent(
          EventType.SESSION_UPDATED,
          { sessionId: id, name, updatedAt: new Date().toISOString() },
          id
        ));
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.post('/sessions/:id/messages',
    describeRoute({
      operationId: 'sessions.messages.add',
      summary: '添加消息到会话',
      tags: ['Messages'],
      responses: {
        200: {
          description: '添加成功',
        },
        404: {
          description: '会话不存在',
        },
      },
    }),
    zValidator('json', AddMessageRequestSchema),
    (c) => {
      const id = c.req.param('id');
      const body = c.req.valid('json');
      
      const message: Message = {
        role: body.role,
        content: body.content,
        timestamp: new Date().toISOString(),
      };
      
      if (sessionStore.addMessage(id, message)) {
        broadcastEvent(createEvent(
          EventType.MESSAGE_RECEIVED,
          {
            sessionId: id,
            role: body.role,
            content: body.content,
            timestamp: message.timestamp,
          },
          id
        ));
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.post('/sessions/:id/chat',
    describeRoute({
      operationId: 'sessions.chat',
      summary: '会话聊天',
      tags: ['Chat'],
      responses: {
        200: {
          description: '聊天响应',
        },
        404: {
          description: '会话不存在',
        },
        500: {
          description: '服务器错误',
        },
      },
    }),
    zValidator('json', ChatRequestSchema),
    async (c) => {
      const id = c.req.param('id');
      const { message } = c.req.valid('json');

      const session = sessionStore.getSession(id);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(id, userMessage);

      const currentSession = sessionStore.getSession(id);
      if (!currentSession) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const response = await provider.chat(currentSession.messages);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(id, assistantMessage);

      broadcastEvent(createEvent(
        EventType.CHAT_COMPLETE,
        {
          sessionId: id,
          content: response.content,
          usage: response.usage ? {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          } : undefined,
        },
        id
      ));

      return c.json({
        response: response.content,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
      });
    }
  );

  app.post('/sessions/:id/chat/stream',
    describeRoute({
      operationId: 'sessions.chat.stream',
      summary: '会话流式聊天',
      tags: ['Chat'],
      responses: {
        200: {
          description: '流式响应',
        },
        404: {
          description: '会话不存在',
        },
      },
    }),
    zValidator('json', ChatRequestSchema),
    async (c) => {
      const id = c.req.param('id');
      const { message } = c.req.valid('json');

      const session = sessionStore.getSession(id);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(id, userMessage);

      const currentSession = sessionStore.getSession(id);
      if (!currentSession) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let fullResponse = '';
            for await (const chunk of provider.streamChat(currentSession.messages)) {
              controller.enqueue(new TextEncoder().encode(chunk));
              fullResponse += chunk;
              
              broadcastEvent(createEvent(
                EventType.CHAT_STREAM,
                { sessionId: id, delta: chunk, done: false },
                id
              ));
            }

            const assistantMessage: Message = {
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
            };
            sessionStore.addMessage(id, assistantMessage);

            broadcastEvent(createEvent(
              EventType.CHAT_STREAM,
              { sessionId: id, delta: '', done: true },
              id
            ));

            broadcastEvent(createEvent(
              EventType.CHAT_COMPLETE,
              { sessionId: id, content: fullResponse },
              id
            ));

            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  );

  app.post('/chat',
    describeRoute({
      operationId: 'chat.send',
      summary: '无会话聊天',
      tags: ['Chat'],
      responses: {
        200: {
          description: '聊天响应',
        },
        500: {
          description: '服务器错误',
        },
      },
    }),
    zValidator('json', ChatWithoutSessionRequestSchema),
    async (c) => {
      const { messages } = c.req.valid('json');

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const response = await provider.chat(messages as Message[]);

      return c.json({
        response: response.content,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
      });
    }
  );

  app.post('/chat/stream',
    describeRoute({
      operationId: 'chat.stream',
      summary: '无会话流式聊天',
      tags: ['Chat'],
      responses: {
        200: {
          description: '流式响应',
        },
        500: {
          description: '服务器错误',
        },
      },
    }),
    zValidator('json', ChatWithoutSessionRequestSchema),
    async (c) => {
      const { messages } = c.req.valid('json');

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of provider.streamChat(messages as Message[])) {
              controller.enqueue(new TextEncoder().encode(chunk));
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        },
      });
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

  return app;
}

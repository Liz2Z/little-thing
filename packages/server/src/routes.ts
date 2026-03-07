/**
 * OpenAPI 路由定义
 * 使用 hono-openapi 实现类型安全的 API 定义
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { describeRoute, validator, resolver } from 'hono-openapi';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { AnthropicProvider } from './providers/anthropic.js';
import { SessionStore } from './session/store.js';
import type { Message } from './session/types.js';
import { eventBus } from './events/bus.js';
import type { Event } from './events/types.js';

const SessionSchema = z.object({
  id: z.string().meta({ description: '会话 ID' }),
  name: z.string().meta({ description: '会话名称' }),
  createdAt: z.string().meta({ description: '创建时间' }),
  updatedAt: z.string().meta({ description: '更新时间' }),
  messageCount: z.number().meta({ description: '消息数量' }),
});

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).meta({ description: '消息角色' }),
  content: z.string().meta({ description: '消息内容' }),
  timestamp: z.string().meta({ description: '消息时间' }),
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

      // Send heartbeat every 10s to prevent stalled proxy streams.
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
      return c.json({ status: 'ok', model: llmConfig.model });
    }
  );

  app.get('/sessions',
    describeRoute({
      operationId: 'sessions.list',
      summary: '获取会话列表',
      description: '获取所有会话的列表',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '会话列表',
          content: {
            'application/json': {
              schema: resolver(z.object({
                sessions: z.array(SessionSchema).meta({ description: '会话列表' }),
              })),
            },
          },
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
      description: '创建一个新的聊天会话',
      tags: ['Sessions'],
      responses: {
        201: {
          description: '创建的会话',
          content: {
            'application/json': {
              schema: resolver(z.object({
                session: SessionSchema.meta({ description: '创建的会话' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      name: z.string().optional().meta({ description: '会话名称' }),
    })),
    (c) => {
      const body = c.req.valid('json');
      const session = sessionStore.createSession(body.name);
      return c.json({ session }, 201);
    }
  );

  app.get('/sessions/:id',
    describeRoute({
      operationId: 'sessions.get',
      summary: '获取会话详情',
      description: '根据 ID 获取会话的详细信息，包括消息历史',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '会话详情',
          content: {
            'application/json': {
              schema: resolver(z.object({
                session: SessionSchema.extend({
                  messages: z.array(MessageSchema).meta({ description: '消息列表' }),
                }).meta({ description: '会话详情' }),
              })),
            },
          },
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
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
      description: '根据 ID 删除指定会话',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '删除成功',
          content: {
            'application/json': {
              schema: resolver(z.object({
                success: z.boolean().meta({ description: '操作是否成功' }),
              })),
            },
          },
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    (c) => {
      const id = c.req.param('id');
      if (sessionStore.deleteSession(id)) {
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.put('/sessions/:id',
    describeRoute({
      operationId: 'sessions.rename',
      summary: '重命名会话',
      description: '修改会话名称',
      tags: ['Sessions'],
      responses: {
        200: {
          description: '重命名成功',
          content: {
            'application/json': {
              schema: resolver(z.object({
                success: z.boolean().meta({ description: '操作是否成功' }),
              })),
            },
          },
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      name: z.string().meta({ description: '新会话名称' }),
    })),
    (c) => {
      const id = c.req.param('id');
      const { name } = c.req.valid('json');

      if (sessionStore.renameSession(id, name)) {
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.post('/sessions/:id/messages',
    describeRoute({
      operationId: 'sessions.messages.add',
      summary: '添加消息到会话',
      description: '向指定会话添加一条消息',
      tags: ['Messages'],
      responses: {
        200: {
          description: '添加成功',
          content: {
            'application/json': {
              schema: resolver(z.object({
                success: z.boolean().meta({ description: '操作是否成功' }),
              })),
            },
          },
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      role: z.enum(['user', 'assistant', 'system']).meta({ description: '消息角色' }),
      content: z.string().meta({ description: '消息内容' }),
    })),
    (c) => {
      const id = c.req.param('id');
      const body = c.req.valid('json');

      const message: Message = {
        role: body.role,
        content: body.content,
        timestamp: new Date().toISOString(),
      };

      if (sessionStore.addMessage(id, message)) {
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    }
  );

  app.post('/sessions/:id/chat',
    describeRoute({
      operationId: 'sessions.chat.send',
      summary: '会话聊天',
      description: '在指定会话中进行聊天，返回 AI 响应',
      tags: ['Chat'],
      responses: {
        200: {
          description: '聊天响应',
          content: {
            'application/json': {
              schema: resolver(z.object({
                response: z.string().meta({ description: 'AI 响应' }),
                usage: z.object({
                  promptTokens: z.number().meta({ description: '输入 token 数' }),
                  completionTokens: z.number().meta({ description: '输出 token 数' }),
                  totalTokens: z.number().meta({ description: '总 token 数' }),
                }).optional().meta({ description: 'Token 使用情况' }),
              })),
            },
          },
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
        500: {
          description: '服务器错误',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      message: z.string().meta({ description: '用户消息' }),
    })),
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
      description: '在指定会话中进行流式聊天，实时返回 AI 响应',
      tags: ['Chat'],
      responses: {
        200: {
          description: '流式响应',
        },
        404: {
          description: '会话不存在',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      message: z.string().meta({ description: '用户消息' }),
    })),
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
            }

            const assistantMessage: Message = {
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
            };
            sessionStore.addMessage(id, assistantMessage);

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
      description: '直接发送消息进行聊天，不需要会话',
      tags: ['Chat'],
      responses: {
        200: {
          description: '聊天响应',
          content: {
            'application/json': {
              schema: resolver(z.object({
                response: z.string().meta({ description: 'AI 响应' }),
                usage: z.object({
                  promptTokens: z.number().meta({ description: '输入 token 数' }),
                  completionTokens: z.number().meta({ description: '输出 token 数' }),
                  totalTokens: z.number().meta({ description: '总 token 数' }),
                }).optional().meta({ description: 'Token 使用情况' }),
              })),
            },
          },
        },
        500: {
          description: '服务器错误',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      messages: z.array(MessageSchema).meta({ description: '消息历史' }),
    })),
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
      description: '直接发送消息进行流式聊天，不需要会话',
      tags: ['Chat'],
      responses: {
        200: {
          description: '流式响应',
        },
        500: {
          description: '服务器错误',
          content: {
            'application/json': {
              schema: resolver(z.object({
                error: z.string().meta({ description: '错误信息' }),
              })),
            },
          },
        },
      },
    }),
    validator('json', z.object({
      messages: z.array(MessageSchema).meta({ description: '消息历史' }),
    })),
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

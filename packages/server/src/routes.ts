import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AnthropicProvider } from './providers/anthropic.js';
import { SessionStore } from './session/store.js';
import type { Message } from './session/types.js';

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

  app.get('/health', (c) => {
    return c.json({ status: 'ok', model: llmConfig.model });
  });

  app.get('/sessions', (c) => {
    const sessions = sessionStore.listSessions();
    return c.json({ sessions });
  });

  app.post('/sessions', async (c) => {
    try {
      const body = await c.req.json();
      const { name } = body;
      const session = sessionStore.createSession(name);
      return c.json({ session }, 201);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.get('/sessions/:id', (c) => {
    const sessionId = c.req.param('id');
    const session = sessionStore.getSession(sessionId);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }
    return c.json({ session });
  });

  app.delete('/sessions/:id', (c) => {
    const sessionId = c.req.param('id');
    if (sessionStore.deleteSession(sessionId)) {
      return c.json({ success: true });
    }
    return c.json({ error: 'Session not found' }, 404);
  });

  app.put('/sessions/:id', async (c) => {
    const sessionId = c.req.param('id');
    try {
      const body = await c.req.json();
      const { name } = body;
      if (!name) {
        return c.json({ error: 'name is required' }, 400);
      }
      if (sessionStore.renameSession(sessionId, name)) {
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.post('/sessions/:id/messages', async (c) => {
    const sessionId = c.req.param('id');
    try {
      const body = await c.req.json();
      const message: Message = {
        role: body.role,
        content: body.content,
        timestamp: new Date().toISOString(),
      };
      if (sessionStore.addMessage(sessionId, message)) {
        return c.json({ success: true });
      }
      return c.json({ error: 'Session not found' }, 404);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  });

  app.post('/sessions/:id/chat', async (c) => {
    const sessionId = c.req.param('id');
    try {
      const session = sessionStore.getSession(sessionId);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const body = await c.req.json();
      const { message } = body;

      if (!message || typeof message !== 'string') {
        return c.json({ error: 'message is required' }, 400);
      }

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(sessionId, userMessage);

      const currentSession = sessionStore.getSession(sessionId);
      if (!currentSession) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const response = await provider.chat(currentSession.messages);

      const assistantMessage: Message = {
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(sessionId, assistantMessage);

      return c.json({
        response: response.content,
        usage: response.usage ? {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        } : undefined,
      });
    } catch (error) {
      console.error('Chat error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  app.post('/sessions/:id/chat/stream', async (c) => {
    const sessionId = c.req.param('id');
    try {
      const session = sessionStore.getSession(sessionId);
      if (!session) {
        return c.json({ error: 'Session not found' }, 404);
      }

      const body = await c.req.json();
      const { message } = body;

      if (!message || typeof message !== 'string') {
        return c.json({ error: 'message is required' }, 400);
      }

      if (!llmConfig.apiKey) {
        return c.json({ error: 'LLM_API_KEY not configured' }, 500);
      }

      const userMessage: Message = {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      };
      sessionStore.addMessage(sessionId, userMessage);

      const currentSession = sessionStore.getSession(sessionId);
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
            sessionStore.addMessage(sessionId, assistantMessage);

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
    } catch (error) {
      console.error('Stream error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  app.post('/chat', async (c) => {
    try {
      const body = await c.req.json();
      const { messages } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return c.json({ error: 'messages array is required' }, 400);
      }

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
    } catch (error) {
      console.error('Chat error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  app.post('/chat/stream', async (c) => {
    try {
      const body = await c.req.json();
      const { messages } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return c.json({ error: 'messages array is required' }, 400);
      }

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
    } catch (error) {
      console.error('Stream error:', error);
      return c.json({
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  });

  app.get('/openapi.json', (c) => {
    return c.json({
      openapi: '3.1.0',
      info: {
        title: 'Agent Platform API',
        version: '1.0.0',
        description: 'API for Agent Platform - a chat application with session management',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'Health status',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string' },
                        model: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/sessions': {
          get: {
            summary: 'List all sessions',
            responses: {
              '200': {
                description: 'List of sessions',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        sessions: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Session' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          post: {
            summary: 'Create a new session',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                  },
                },
              },
            },
            responses: {
              '201': {
                description: 'Created session',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        session: { $ref: '#/components/schemas/Session' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        '/sessions/{id}': {
          get: {
            summary: 'Get session by ID',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Session details',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        session: { $ref: '#/components/schemas/SessionDetail' },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
          put: {
            summary: 'Rename session',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                    },
                    required: ['name'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
          delete: {
            summary: 'Delete session',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
        '/sessions/{id}/messages': {
          post: {
            summary: 'Add message to session',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                      content: { type: 'string' },
                    },
                    required: ['role', 'content'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
        '/sessions/{id}/chat': {
          post: {
            summary: 'Chat within a session',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                    required: ['message'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Chat response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        usage: { $ref: '#/components/schemas/Usage' },
                      },
                    },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
              '500': {
                description: 'Server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
        '/sessions/{id}/chat/stream': {
          post: {
            summary: 'Stream chat within a session',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                    },
                    required: ['message'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Streamed response',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
              '404': {
                description: 'Session not found',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
              '500': {
                description: 'Server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
        '/chat': {
          post: {
            summary: 'Chat without session',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      messages: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Message' },
                      },
                    },
                    required: ['messages'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Chat response',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        response: { type: 'string' },
                        usage: { $ref: '#/components/schemas/Usage' },
                      },
                    },
                  },
                },
              },
              '500': {
                description: 'Server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
        '/chat/stream': {
          post: {
            summary: 'Stream chat without session',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      messages: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Message' },
                      },
                    },
                    required: ['messages'],
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Streamed response',
                content: {
                  'text/plain': {
                    schema: { type: 'string' },
                  },
                },
              },
              '500': {
                description: 'Server error',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Error' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Session: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              messageCount: { type: 'integer' },
            },
            required: ['id', 'name', 'createdAt', 'updatedAt', 'messageCount'],
          },
          SessionDetail: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              messageCount: { type: 'integer' },
              messages: {
                type: 'array',
                items: { $ref: '#/components/schemas/Message' },
              },
            },
            required: ['id', 'name', 'createdAt', 'updatedAt', 'messageCount', 'messages'],
          },
          Message: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['role', 'content', 'timestamp'],
          },
          Usage: {
            type: 'object',
            properties: {
              promptTokens: { type: 'integer' },
              completionTokens: { type: 'integer' },
              totalTokens: { type: 'integer' },
            },
          },
          Error: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
            required: ['error'],
          },
        },
      },
    });
  });

  return app;
}

import { Hono } from 'hono';
import { describeRoute, validator, resolver } from 'hono-openapi';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { createSessionService } from '../session/index.js';
import { NotFoundError, SessionErrors } from '../errors/index.js';

const SessionSchema = z.object({
  id: z.string().meta({ description: '会话 ID' }),
  name: z.string().meta({ description: '会话名称' }),
  createdAt: z.string().meta({ description: '创建时间' }),
  updatedAt: z.string().meta({ description: '更新时间' }),
  messageCount: z.number().meta({ description: '消息数量' }),
});

const MessageSchema = z.object({
  id: z.string().meta({ description: '消息 ID' }),
  role: z.enum(['user', 'assistant', 'system']).meta({ description: '消息角色' }),
  content: z.string().meta({ description: '消息内容' }),
  timestamp: z.string().meta({ description: '消息时间' }),
});

const sessionService = createSessionService(process.cwd());

const app = new Hono();

app.get('/',
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
    const sessions = sessionService.listSessions();
    return c.json({ sessions });
  }
);

app.post('/',
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
    provider: z.string().optional().meta({ description: 'LLM Provider 名称' }),
    model: z.string().optional().meta({ description: 'LLM 模型名称' }),
  })),
  (c) => {
    const body = c.req.valid('json');
    const session = sessionService.createSession(body.name, body.provider, body.model);
    return c.json({ session }, 201);
  }
);

app.get('/:id',
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
    const session = sessionService.getSession(id);
    if (!session) {
      throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
    }
    return c.json({ session });
  }
);

app.delete('/:id',
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
    if (sessionService.deleteSession(id)) {
      return c.json({ success: true });
    }
    throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
  }
);

app.put('/:id',
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

    if (sessionService.renameSession(id, name)) {
      return c.json({ success: true });
    }
    throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
  }
);

app.post('/:id/fork',
  describeRoute({
    operationId: 'sessions.fork',
    summary: 'Fork 会话',
    description: '从指定消息的某个位置创建一个新会话，保留该位置之前的所有消息',
    tags: ['Sessions'],
    responses: {
      201: {
        description: 'Fork 成功',
        content: {
          'application/json': {
            schema: resolver(z.object({
              session: SessionSchema.meta({ description: '新创建的会话' }),
            })),
          },
        },
      },
      404: {
        description: '会话或消息不存在',
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
    messageId: z.string().meta({ description: '消息 ID' }),
    name: z.string().optional().meta({ description: '新会话名称' }),
  })),
  (c) => {
    const id = c.req.param('id');
    const { messageId, name } = c.req.valid('json');

    const newSession = sessionService.forkSession(id, messageId, name);
    if (newSession) {
      return c.json({ session: newSession }, 201);
    }
    throw new NotFoundError(SessionErrors.OR_MESSAGE_NOT_FOUND, { sessionId: id, messageId });
  }
);

app.post('/:id/resume',
  describeRoute({
    operationId: 'sessions.resume',
    summary: 'Resume 会话',
    description: '在指定消息位置之后恢复对话，截断该消息之后的所有消息',
    tags: ['Sessions'],
    responses: {
      200: {
        description: 'Resume 成功',
        content: {
          'application/json': {
            schema: resolver(z.object({
              success: z.boolean().meta({ description: '操作是否成功' }),
            })),
          },
        },
      },
      404: {
        description: '会话或消息不存在',
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
    messageId: z.string().meta({ description: '消息 ID' }),
  })),
  (c) => {
    const id = c.req.param('id');
    const { messageId } = c.req.valid('json');

    if (sessionService.resumeSession(id, messageId)) {
      return c.json({ success: true });
    }
    throw new NotFoundError(SessionErrors.OR_MESSAGE_NOT_FOUND, { sessionId: id, messageId });
  }
);

app.post('/:id/messages',
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
    timestamp: z.string().optional().meta({ description: '消息时间' }),
  })),
  (c) => {
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const message = {
      role: body.role,
      content: { type: 'text' as const, text: body.content },
      timestamp: body.timestamp || new Date().toISOString(),
    };

    if (sessionService.addMessage(id, message)) {
      return c.json({ success: true });
    }
    throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
  }
);

app.post('/:id/chat',
  describeRoute({
    operationId: 'sessions.chat.send',
    summary: 'Agent 对话',
    description: '使用 Agent 模式进行对话，支持工具调用和 ReAct 循环，返回 SSE 事件流',
    tags: ['Agent'],
    responses: {
      200: {
        description: 'SSE 事件流',
        content: {
          'text/event-stream': {
            schema: resolver(z.object({
              event: z.string().meta({ description: '事件类型' }),
              data: z.string().meta({ description: '事件数据 JSON' }),
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
    enabledTools: z.array(z.string()).optional().meta({ description: '启用的工具列表' }),
    provider: z.string().optional().meta({ description: 'LLM Provider 名称' }),
    model: z.string().optional().meta({ description: 'LLM 模型名称' }),
  })),
  async (c) => {
    const id = c.req.param('id');
    const { message, enabledTools, provider, model } = c.req.valid('json');

    const session = sessionService.getSession(id);
    if (!session) {
      throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
    }

    return streamSSE(c, async (stream) => {
      for await (const event of sessionService.chat(id, message, {
        enabledTools,
        provider,
        model,
      })) {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event),
        });
      }
    });
  }
);

app.post('/:id/agent/abort',
  describeRoute({
    operationId: 'agent.abort',
    summary: '终止 Agent 运行',
    description: '终止当前正在运行的 Agent',
    tags: ['Agent'],
    responses: {
      200: {
        description: '终止成功',
        content: {
          'application/json': {
            schema: resolver(z.object({
              success: z.boolean().meta({ description: '是否成功' }),
            })),
          },
        },
      },
    },
  }),
  validator('json', z.object({
    run_id: z.string().meta({ description: '要终止的运行 ID' }),
  })),
  async (c) => {
    const { run_id } = c.req.valid('json');
    sessionService.abort(run_id);
    return c.json({ success: true });
  }
);

export const sessionRoutes = app;

import { Hono } from 'hono';
import { describeRoute, resolver } from 'hono-openapi';
import { z } from 'zod';
import modelsData from '../providers/models.json';

const app = new Hono();

app.get(
  '/models',
  describeRoute({
    operationId: 'provider.models.list',
    summary: '获取可用模型列表',
    description: '从当前配置的 LLM Provider 获取可用模型列表',
    tags: ['Provider'],
    responses: {
      200: {
        description: '可用模型列表',
        content: {
          'application/json': {
            schema: resolver(
              z.object({
                providers: z.array(
                  z.object({
                    id: z.string().meta({ description: '供应商 ID' }),
                    name: z.string().meta({ description: '供应商名称' }),
                    models: z.array(
                      z.object({
                        id: z.string().meta({ description: '模型 ID' }),
                        name: z.string().meta({ description: '模型名称' }),
                        displayName: z.string().optional().meta({ description: '显示名称' }),
                        description: z.string().optional().meta({ description: '模型描述' }),
                        contextLength: z.number().optional().meta({ description: '上下文长度' }),
                      }),
                    ),
                  }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  (c) => {
    // 将 models.json 转换为响应格式
    const providers = Object.entries(modelsData).map(([providerId, providerData]: [string, any]) => ({
      id: providerId,
      name: providerData.name || providerId,
      models: Object.entries(providerData.models || {}).map(([modelId, modelData]: [string, any]) => ({
        id: modelId,
        name: modelId,
        displayName: modelData.display_name || modelData.name || modelId,
        description: modelData.description,
        contextLength: modelData.context_length,
      })),
    }));

    return c.json({ providers });
  },
);

export const providerRoutes = app;

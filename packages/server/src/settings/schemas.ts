import { z } from 'zod';

export const providerSchema = z.object({
  name: z.string(),
  models: z.array(z.string()),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
});

export const llmSchema = z.object({
  provider: z.string(),
  model: z.string(),
  baseUrl: z.string().url(),
  apiKey: z.string(),
  timeout: z.number().min(1000).max(120000).optional(),
  maxRetries: z.number().min(0).max(5).optional(),
});

export const serverSchema = z.object({
  port: z.coerce.number().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
});

export const loggingSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['text', 'json']).default('text'),
});

export const settingsSchema = z.object({
  version: z.string().optional().default('1.0.0'),
  llm: llmSchema.default({
    provider: 'zhipu-coding-plan',
    model: 'glm-4.7',
    baseUrl: 'https://open.bigmodel.cn/api/anthropic',
    apiKey: '',
    timeout: 30000,
    maxRetries: 3,
  }),
  providers: z.record(z.string(), providerSchema).default({}),
  server: serverSchema.default({
    port: 3000,
    host: 'localhost',
  }),
  logging: loggingSchema.default({
    level: 'info',
    format: 'text',
  }),
  ui: z.record(z.string(), z.unknown()).default({}),
});



import { z } from 'zod';

// Provider 配置 Schema
export const providerSchema = z.object({
  models: z.array(z.string()).optional(),
  baseUrl: z.string().url(),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
});

// LLM 配置 Schema
export const llmSchema = z.object({
  provider: z.string().default('zhipu'),
  model: z.string().default('glm-4.7'),
  // 顶层 baseUrl, timeout, maxRetries 作为默认 Provider 的默认覆盖
  baseUrl: z.string().url().optional(),
  timeout: z.number().min(1000).max(120000).optional(),
  maxRetries: z.number().min(0).max(5).optional(),
});

// 服务器配置 Schema
export const serverSchema = z.object({
  port: z.number().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
});

// 日志配置 Schema
export const loggingSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  format: z.enum(['text', 'json']).default('text'),
});

// 完整 Settings Schema
export const settingsSchema = z.object({
  version: z.string().optional().default('1.0.0'),
  llm: llmSchema.default({
    provider: 'zhipu',
    model: 'glm-4.7',
  }),
  providers: z.object({}).catchall(providerSchema).default({}),
  customProviders: z.object({}).catchall(providerSchema).default({}),
  server: serverSchema.default({
    port: 3000,
    host: 'localhost',
  }),
  logging: loggingSchema.default({
    level: 'info',
    format: 'text',
  }),
  ui: z.object({}).catchall(z.unknown()).default({}),
});

// Credentials Schema
export const credentialsSchema = z.object({
  providers: z.object({}).catchall(z.string()).default({}),
  customProviders: z.object({}).catchall(z.string()).default({}),
});

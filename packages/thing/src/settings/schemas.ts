import { z } from "zod";

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
  thinkingEnabled: z.boolean().default(false),
  thinkingBudgetTokens: z
    .number()
    .min(1000)
    .max(100000)
    .default(16000)
    .optional(),
});

export const serverSchema = z.object({
  port: z.coerce.number().min(1).max(65535).default(3000),
  host: z.string().default("localhost"),
});

export const loggingSchema = z.object({
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  format: z.enum(["text", "json"]).default("text"),
});

export const promptSettingsSchema = z.object({
  globalSystemPrompt: z.string().optional(),
  providers: z.record(z.string(), z.string()).default({}),
  models: z.record(z.string(), z.string()).default({}),
});

export const toolPermissionRuleSchema = z.object({
  tool: z.string(),
  action: z.enum(["allow", "ask", "deny"]),
  cwd: z.string().optional(),
  sessionId: z.string().optional(),
});

export const toolsSettingsSchema = z.object({
  defaultAction: z.enum(["allow", "ask", "deny"]).default("allow"),
  rules: z.array(toolPermissionRuleSchema).default([]),
});

export const loopGuardSchema = z.object({
  enabled: z.boolean().default(true),
  windowSize: z.number().min(2).max(20).default(6),
  maxRepeats: z.number().min(1).max(10).default(3),
});

export const agentSettingsSchema = z.object({
  loopGuard: loopGuardSchema.default({
    enabled: true,
    windowSize: 6,
    maxRepeats: 3,
  }),
});

export const settingsSchema = z.object({
  version: z.string().optional().default("1.0.0"),
  llm: llmSchema.default({
    provider: "zhipu-coding-plan",
    model: "glm-4.7",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    apiKey: "",
    timeout: 30000,
    maxRetries: 3,
    thinkingEnabled: false,
    thinkingBudgetTokens: 16000,
  }),
  providers: z.record(z.string(), providerSchema).default({}),
  server: serverSchema.default({
    port: 3000,
    host: "localhost",
  }),
  logging: loggingSchema.default({
    level: "info",
    format: "text",
  }),
  prompts: promptSettingsSchema.default({
    providers: {},
    models: {},
  }),
  tools: toolsSettingsSchema.default({
    defaultAction: "allow",
    rules: [],
  }),
  agent: agentSettingsSchema.default({
    loopGuard: {
      enabled: true,
      windowSize: 6,
      maxRepeats: 3,
    },
  }),
  ui: z.record(z.string(), z.unknown()).default({}),
});

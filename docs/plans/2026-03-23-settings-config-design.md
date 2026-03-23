# Settings 配置系统设计

## 概述

设计一套轻量级的配置系统，支持多层级配置（全局 + 项目局部）、深度合并、类型安全和环境变量替换。

## 核心需求

1. **多层级配置**：全局默认配置 + 项目局部配置覆写
2. **深度合并**：局部配置只覆盖指定字段，其他字段继承全局配置
3. **类型安全**：基于 zod schema 定义，自动推导 TypeScript 类型
4. **环境变量**：支持 `${VAR}` 和 `${VAR:-default}` 语法
5. **增强验证**：Schema 验证 + 业务规则验证

## 架构

```
应用启动
    │
    ▼
配置加载与合并
    ├─ 全局配置 (~/.config/littlething/settings.json)
    ├─ 局部配置 (./.littlething/settings.json)
    ▼
深度合并 + 验证
    ▼
config 对象（只读）
```

## 文件结构

```
packages/server/src/config/
├── schema.ts          # zod schema 定义
├── loader.ts          # 配置加载和合并逻辑
├── validator.ts       # 验证逻辑
├── types.ts           # TypeScript 类型导出
└── index.ts           # 主入口
```

## 配置层级

### 全局配置

```bash
~/.config/littlething/settings.json
```

### 局部配置

```bash
./.littlething/settings.json
```

### 合并策略

深度合并（deep merge），示例：

```json
// 全局配置
{
  "llm": {
    "provider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "timeout": 30000
  }
}

// 局部配置
{
  "llm": {
    "provider": "openai"
  }
}

// 运行时结果
{
  "llm": {
    "provider": "openai",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "timeout": 30000
  }
}
```

## Schema 定义

```typescript
import { z } from 'zod';

const llmSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'zhipu', 'moonshot']).default('anthropic'),
  apiKey: z.string().optional(),
  baseUrl: z.string().url(),
  model: z.string().default('claude-sonnet-4-6'),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
});

const providersSchema = z.object({
  anthropic: z.object({
    enabled: z.boolean().default(true),
    baseUrl: z.string().url().default('https://api.anthropic.com'),
    apiKey: z.string().optional(),
    models: z.array(z.string()).default(['claude-sonnet-4-6']),
  }),
  // ... 其他 provider
});

const uiSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().min(12).max(24).default(14),
});

export const settingsSchema = z.object({
  llm: llmSchema,
  providers: providersSchema,
  ui: uiSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
```

## API 设计

```typescript
// 加载配置
export async function loadConfig(options?: {
  globalPath?: string;
  projectPath?: string;
}): Promise<void>;

// 只读配置对象
export const config: Readonly<Settings>;

// 重新加载
export async function reloadConfig(): Promise<void>;

// 获取原始配置
export function getRawConfig(): unknown;

// 验证配置
export function validateConfig(data: unknown): Settings;
```

## 使用示例

```typescript
// 启动时加载
import { loadConfig, config } from './config';
await loadConfig();

// 任何地方使用
console.log('LLM Provider:', config.llm.provider);
console.log('Timeout:', config.llm.timeout);
```

## 错误处理

```typescript
export class ConfigError extends Error {
  code: string;
}

export class ConfigValidationError extends ConfigError {
  errors: z.ZodIssue[];
}

export class ConfigFileNotFoundError extends ConfigError {
  path: string;
}
```

## 配置示例

```json
{
  "llm": {
    "provider": "anthropic",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "baseUrl": "https://api.anthropic.com",
    "model": "claude-sonnet-4-6",
    "timeout": 30000
  },
  "providers": {
    "anthropic": {
      "enabled": true,
      "baseUrl": "https://api.anthropic.com",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": ["claude-sonnet-4-6", "claude-opus-4-6"]
    },
    "openai": {
      "enabled": false
    }
  },
  "ui": {
    "theme": "auto",
    "fontSize": 14
  }
}
```

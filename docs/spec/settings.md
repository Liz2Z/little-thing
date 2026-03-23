# Settings 配置系统技术规范

## 概述

Settings 是服务端内部配置模块，负责管理 LLM 连接参数和 UI 偏好。采用多层级配置、深度合并、类型安全和环境变量替换。

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 配置归属 | 纯服务端 | 所有读写逻辑由 server 处理，前端不感知 |
| API 暴露 | 不暴露 | Settings 是内部实现，无对外 API |
| 加载时机 | 启动时一次性加载 | 简单可靠，变更需重启 |
| 环境变量替换 | 仅字符串值 | 避免类型转换歧义 |
| 配置缺失 | 使用默认值 | 开箱即用，无需强制创建配置文件 |
| 模块位置 | `packages/server/src/config/` | 服务端内部使用，无跨包共享需求 |

## 配置层级

```
全局配置: ~/.config/littlething/settings.json
局部配置: ./.littlething/settings.json
```

### 合并策略

深度合并（deep merge），局部配置覆盖全局配置的同名字段。

```json
// 全局配置
{
  "llm": {
    "name": "global",
    "messageStyle": "anthropic-messages",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "timeout": 30000
  }
}

// 局部配置
{
  "llm": {
    "name": "local-dev",
    "model": "glm-4-flash"
  }
}

// 运行时结果
{
  "llm": {
    "name": "local-dev",
    "messageStyle": "anthropic-messages",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "timeout": 30000,
    "model": "glm-4-flash"
  }
}
```

## Schema 定义

```typescript
import { z } from 'zod';

// 消息格式风格
const messageStyleSchema = z.enum([
  'anthropic-messages',
  'openai-completions',
  'gemini-generateContent',
]).default('anthropic-messages');

// LLM 配置
const llmSchema = z.object({
  name: z.string().default('default'),
  messageStyle: messageStyleSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().default('glm-4.7'),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
});

// UI 配置
const uiSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().min(12).max(24).default(14),
});

// 完整配置
export const settingsSchema = z.object({
  llm: llmSchema,
  ui: uiSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
```

## 文件结构

```
packages/server/src/config/
├── schema.ts          # zod schema 定义（唯一的默认值来源）
├── loader.ts          # 配置加载和合并逻辑
├── env.ts             # 环境变量替换
├── index.ts           # 主入口，导出 config 对象
└── types.ts           # TypeScript 类型导出
```

## API 设计

```typescript
// 加载配置（启动时调用一次）
export async function loadConfig(options?: {
  globalPath?: string;    // 默认: ~/.config/littlething/settings.json
  projectPath?: string;   // 默认: ./.littlething/settings.json
}): Promise<void>;

// 只读配置对象（运行时访问）
export const config: Readonly<Settings>;

// 验证配置（可选，用于手动验证）
export function validateConfig(data: unknown): Settings;
```

## 使用示例

```typescript
// server 启动时
import { loadConfig, config } from './config';

await loadConfig();

// 任何地方访问配置
console.log('LLM Name:', config.llm.name);
console.log('Model:', config.llm.model);
console.log('Theme:', config.ui.theme);
```

## 环境变量替换

仅字符串值支持环境变量替换：

| 语法 | 说明 |
|------|------|
| `${VAR}` | 替换为环境变量 VAR 的值 |
| `${VAR:-default}` | VAR 不存在时使用 default |

```json
{
  "llm": {
    "apiKey": "${ANTHROPIC_API_KEY}",
    "baseUrl": "${API_BASE_URL:-https://api.anthropic.com}"
  }
}
```

## 错误处理

```typescript
// 配置错误基类
export class ConfigError extends Error {
  code: string;
}

// Schema 验证失败
export class ConfigValidationError extends ConfigError {
  errors: z.ZodIssue[];
}

// 环境变量替换失败
export class ConfigEnvError extends ConfigError {
  variable: string;
}
```

## 配置示例

```json
{
  "llm": {
    "name": "production",
    "messageStyle": "anthropic-messages",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "model": "claude-sonnet-4-6",
    "timeout": 60000,
    "maxRetries": 3
  },
  "ui": {
    "theme": "dark",
    "fontSize": 14
  }
}
```

## messageStyle 说明

| 值 | Provider | 说明 |
|----|----------|------|
| `anthropic-messages` | Anthropic | Claude API 原生消息格式 |
| `openai-completions` | OpenAI | OpenAI Chat Completions API 格式 |
| `gemini-generateContent` | Google | Gemini 原生 API 格式 |

`messageStyle` 同时决定了：
1. 请求/响应的消息格式
2. 使用的 SDK 客户端

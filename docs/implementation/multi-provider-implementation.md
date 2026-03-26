# 多模型供应商支持 - 实施文档

## 概述

本文档描述基于 Vercel AI SDK 的多模型供应商支持实现方案。

**核心思路**：

1. 前端传递 `provider` 和 `model`
2. 从 `models.json` 查询配置（SDK 包名、baseUrl、环境变量）
3. 在外部初始化 model，依赖注入 Agent
4. Agent 直接使用 AI SDK 的 `streamText()` 和 `fullStream`

## 数据流

```
前端请求 { provider: 'zhipuai-coding-plan', model: 'glm-4.7' }
                    │
                    ▼
        ┌─────────────────────┐
        │    models.json      │
        │  查询 provider 配置: │
        │  - npm: @ai-sdk/xxx │
        │  - api: baseUrl     │
        │  - env: API_KEY 名   │
        └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │   createModel()     │
        │   创建 model 实例    │
        └─────────────────────┘
                    │
                    ▼ (依赖注入)
        ┌─────────────────────┐
        │      Agent          │
        │   streamText()      │
        └─────────────────────┘
```

## models.json 结构

```json
{
  "zhipuai-coding-plan": {
    "id": "zhipuai-coding-plan",
    "env": ["ZHIPU_API_KEY"],
    "npm": "@ai-sdk/openai-compatible",
    "api": "https://open.bigmodel.cn/api/coding/paas/v4",
    "name": "Zhipu AI Coding Plan",
    "models": {
      "glm-4.7": { ... }
    }
  }
}
```

字段说明：
- `npm`: AI SDK 包名，如 `@ai-sdk/openai-compatible`、`@ai-sdk/anthropic`
- `api`: baseUrl
- `env`: 环境变量名，用于获取 apiKey

## 目录结构

```
packages/server/src/
├── providers/
│   ├── index.ts              # 导出
│   ├── models.json           # 模型配置数据
│   └── factory.ts            # 创建 AI SDK model 实例
├── session/
│   ├── types.ts              # Message 类型定义
│   ├── store.ts              # 消息存储
│   └── convert.ts            # Message → CoreMessage 转换
└── agent/
    ├── agent.ts              # 接收 model 依赖注入
    └── convert.ts            # ToolDefinition → ToolSet 转换
```

## 依赖

```json
{
  "dependencies": {
    "ai": "^5.0.0",
    "@ai-sdk/anthropic": "^2.0.0",
    "@ai-sdk/openai": "^2.0.0",
    "@ai-sdk/openai-compatible": "^1.0.0"
  }
}
```

## 实现步骤

### 步骤 1：Provider 工厂 (providers/factory.ts)

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import modelsData from './models.json';

interface ProviderConfig {
  npm: string;
  api: string;
  env: string[];
}

export function createModel(providerId: string, modelId: string) {
  const providerConfig = modelsData[providerId] as ProviderConfig | undefined;

  if (!providerConfig) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const apiKey = getApiKey(providerConfig.env);

  switch (providerConfig.npm) {
    case '@ai-sdk/anthropic':
      const anthropic = createAnthropic({ apiKey, baseURL: providerConfig.api });
      return anthropic(modelId);

    case '@ai-sdk/openai':
      const openai = createOpenAI({ apiKey, baseURL: providerConfig.api });
      return openai(modelId);

    case '@ai-sdk/openai-compatible':
      const compatible = createOpenAICompatible({ apiKey, baseURL: providerConfig.api });
      return compatible(modelId);

    default:
      throw new Error(`Unsupported SDK: ${providerConfig.npm}`);
  }
}

function getApiKey(envNames: string[]): string {
  for (const name of envNames) {
    const key = process.env[name];
    if (key) return key;
  }
  throw new Error(`Missing API key. Set one of: ${envNames.join(', ')}`);
}
```

### 步骤 2：修改 Agent (agent/agent.ts)

Agent 通过构造函数接收 model，不在内部创建：

```typescript
import { streamText, type LanguageModel } from 'ai';
import { toModelMessages } from '../session/convert.js';
import { toToolSet } from './convert.js';

export class Agent {
  constructor(
    private model: LanguageModel,
    private toolExecutor: ToolExecutor,
  ) {}

  async *run(message: string, messages: Message[], options: AgentOptions = {}) {
    const result = streamText({
      model: this.model,
      messages: toModelMessages([...messages, { role: 'user', content: message }]),
      tools: toToolSet(this.toolExecutor.getDefinitions(options.enabledTools)),
      maxTokens: 4096,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield { type: 'content', delta: part.text };
          break;

        case 'reasoning':
          yield { type: 'thinking', delta: part.text };
          break;

        case 'tool-call':
          const result = await this.toolExecutor.execute(part.toolName, part.args);
          // 处理结果...
          break;

        case 'finish':
          yield { type: 'done', usage: part.usage };
          break;
      }
    }
  }
}
```

### 步骤 3：修改 Session/路由层

在处理请求时创建 model 并注入 Agent：

```typescript
import { createModel } from '../providers/factory.js';

// 处理聊天请求
async function handleChat(req: Request) {
  const { provider, model: modelId, message } = await req.json();

  // 创建 model 实例
  const model = createModel(provider, modelId);

  // 创建 Agent（或从池中获取）
  const agent = new Agent(model, toolRegistry);

  // 执行
  return agent.run(message, messages);
}
```

### 步骤 4：消息转换 (session/convert.ts)

由 Session 模块负责将内部 Message 转换为 AI SDK CoreMessage：

```typescript
import { type CoreMessage } from 'ai';
import type { Message } from './types.js';

export function toModelMessages(messages: Message[]): CoreMessage[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return { role: msg.role, content: msg.content };
    }

    // 处理 tool_use / tool_result
    // ...
  });
}
```

### 步骤 5：工具转换 (agent/convert.ts)

由 Agent 模块负责将 ToolDefinition 转换为 AI SDK ToolSet：

```typescript
import { type ToolSet } from 'ai';
import { z } from 'zod';
import type { ToolDefinition } from '../tools/types.js';

export function toToolSet(tools: ToolDefinition[]): ToolSet {
  // 转换 TypeBox schema 到 zod schema
}
```

### 步骤 6：删除旧代码

- 删除 `providers/anthropic.ts`
- 删除 `providers/types.ts` 中不再使用的类型
- 新增 `session/convert.ts`
- 新增 `agent/convert.ts`

## AI SDK fullStream 事件类型

| 事件类型 | 说明 |
|---------|------|
| `text-delta` | 文本增量，`part.text` |
| `reasoning` | 思考过程，`part.text` |
| `tool-call` | 工具调用，`part.toolCallId`, `part.toolName`, `part.args` |
| `error` | 错误，`part.error` |
| `finish` | 完成，`part.usage`, `part.finishReason` |

## 测试计划

1. **格式转换测试** - 确保消息和工具转换正确
2. **集成测试** - 各 provider API 调用
3. **回归测试** - 确保功能正常

## 风险和缓解

| 风险 | 缓解措施 |
|------|---------|
| AI SDK 版本更新 | 锁定版本号 |
| 格式转换复杂度 | 写单元测试覆盖 |

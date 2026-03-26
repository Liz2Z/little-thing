# 多模型供应商支持 - 实施文档

## 概述

本文档描述多模型供应商支持的具体实现方案。

## 目录结构

```
packages/server/src/
├── providers/
│   ├── index.ts           # 导出和 Provider 工厂
│   ├── types.ts           # 类型定义
│   ├── base.ts            # Provider 基类（可选）
│   ├── anthropic.ts       # Anthropic Provider
│   ├── openai.ts          # OpenAI Provider
│   └── gemini.ts          # Gemini Provider
├── models/
│   ├── models.json        # 从 models.dev 拉取的数据
│   └── sync.ts            # 同步脚本
└── agent/
    ├── agent.ts           # Agent 核心（接收 Provider 实例）
    └── context.ts         # Agent 上下文
```

## 实现步骤

### 步骤 1：定义类型 (providers/types.ts)

```typescript
// 模型元信息
export interface Model {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

// 对话选项
export interface ChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  tools?: Tool[];
}

// 统一消息格式（基于 Anthropic）
export interface Message {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: { type: string; media_type: string; data: string };
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

// 统一响应格式
export interface ChatResponse {
  id: string;
  role: 'assistant';
  content: ContentBlock[];
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// 流式 chunk
export interface StreamChunk {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  index?: number;
  delta?: TextDelta | InputJsonDelta;
  content_block?: ContentBlock;
}

export interface TextDelta {
  type: 'text_delta';
  text: string;
}

export interface InputJsonDelta {
  type: 'input_json_delta';
  partial_json: string;
}

// 工具定义
export interface Tool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// Provider 接口
export interface Provider {
  readonly name: string;
  listModels(): Promise<Model[]>;
  chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>;
  stream(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
}
```

### 步骤 2：Anthropic Provider (providers/anthropic.ts)

Anthropic 是基准格式，转换逻辑最简单：

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { Provider, Message, ChatOptions, ChatResponse, StreamChunk } from './types';

export class AnthropicProvider implements Provider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<Model[]> {
    // Anthropic 没有列出模型的 API，使用硬编码或 models.json
    return [];
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      messages: messages as Anthropic.Messages.MessageParam[],
      system: options.system,
      tools: options.tools,
    });

    return {
      id: response.id,
      role: 'assistant',
      content: response.content as ContentBlock[],
      stop_reason: response.stop_reason,
      usage: response.usage,
    };
  }

  async *stream(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 4096,
      messages: messages as Anthropic.Messages.MessageParam[],
      system: options.system,
      tools: options.tools,
    });

    for await (const event of stream) {
      // Anthropic SDK 已经处理了流式事件，直接转发
      yield event as StreamChunk;
    }
  }
}
```

### 步骤 3：OpenAI Provider (providers/openai.ts)

需要转换 OpenAI 格式到 Anthropic 格式：

```typescript
import OpenAI from 'openai';
import type { Provider, Message, ChatOptions, ChatResponse, StreamChunk, ContentBlock } from './types';

export class OpenAIProvider implements Provider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async listModels(): Promise<Model[]> {
    const models = await this.client.models.list();
    return models.data
      .filter(m => m.id.includes('gpt'))
      .map(m => ({
        id: m.id,
        displayName: m.id,
        contextWindow: 128000, // 从 models.json 获取
      }));
  }

  // 转换 Anthropic 格式消息到 OpenAI 格式
  private toOpenAIMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content };
      }

      // 处理多模态内容
      const parts: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map(block => {
        if (block.type === 'text') {
          return { type: 'text', text: block.text! };
        }
        if (block.type === 'image') {
          return {
            type: 'image_url',
            image_url: { url: `data:${block.source!.media_type};base64,${block.source!.data}` },
          };
        }
        // tool_use 和 tool_result 需要特殊处理
        // ...
      });

      return { role: msg.role, content: parts };
    });
  }

  // 转换 OpenAI 响应到 Anthropic 格式
  private toAnthropicResponse(response: OpenAI.Chat.ChatCompletion): ChatResponse {
    const content: ContentBlock[] = [];

    response.choices.forEach((choice, index) => {
      if (choice.message.content) {
        content.push({ type: 'text', text: choice.message.content });
      }
      if (choice.message.tool_calls) {
        choice.message.tool_calls.forEach(tool => {
          content.push({
            type: 'tool_use',
            id: tool.id,
            name: tool.function.name,
            input: JSON.parse(tool.function.arguments),
          });
        });
      }
    });

    return {
      id: response.id,
      role: 'assistant',
      content,
      stop_reason: response.choices[0].finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async chat(messages: Message[], options: ChatOptions): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: this.toOpenAIMessages(messages),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    });

    return this.toAnthropicResponse(response);
  }

  async *stream(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: this.toOpenAIMessages(messages),
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      tools: options.tools?.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
      stream: true,
    });

    // 混合模式处理
    const toolCallBuffers: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let textIndex = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (!delta) continue;

      // 处理文本内容 - 实时转换
      if (delta.content) {
        yield {
          type: 'content_block_delta',
          index: textIndex,
          delta: { type: 'text_delta', text: delta.content },
        };
      }

      // 处理工具调用 - 缓冲
      if (delta.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          const index = toolCall.index;

          if (!toolCallBuffers.has(index)) {
            toolCallBuffers.set(index, {
              id: toolCall.id ?? '',
              name: toolCall.function?.name ?? '',
              arguments: '',
            });

            // 发送 content_block_start
            yield {
              type: 'content_block_start',
              index: index + 1, // 假设文本是 index 0
              content_block: {
                type: 'tool_use',
                id: toolCall.id,
                name: toolCall.function?.name,
              },
            };
          }

          const buffer = toolCallBuffers.get(index)!;
          if (toolCall.function?.arguments) {
            buffer.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    // 流结束，发送完整的 tool_use
    for (const [index, buffer] of toolCallBuffers) {
      yield {
        type: 'content_block_delta',
        index: index + 1,
        delta: {
          type: 'input_json_delta',
          partial_json: buffer.arguments,
        },
      };
      yield {
        type: 'content_block_stop',
        index: index + 1,
      };
    }

    yield { type: 'message_stop' };
  }
}
```

### 步骤 4：Provider 工厂 (providers/index.ts)

```typescript
import type { Provider } from './types';
import { AnthropicProvider } from './anthropic';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';

export type ProviderName = 'anthropic' | 'openai' | 'gemini';

export function createProvider(
  name: ProviderName,
  apiKey: string
): Provider {
  switch (name) {
    case 'anthropic':
      return new AnthropicProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    case 'gemini':
      return new GeminiProvider(apiKey);
    default:
      throw new Error(`Unknown provider: ${name}`);
  }
}

export { type Provider, type Message, type ChatOptions, type ChatResponse, type StreamChunk } from './types';
```

### 步骤 5：同步 models.json (models/sync.ts)

```typescript
import { writeFileSync } from 'fs';
import { join } from 'path';

const MODELS_DEV_URL = 'https://models.dev/api.json';

interface ModelsDevData {
  [provider: string]: {
    models: {
      [modelId: string]: {
        name: string;
        context_length: number;
        supports_vision?: boolean;
        supports_tools?: boolean;
      };
    };
  };
}

async function syncModels() {
  const response = await fetch(MODELS_DEV_URL);
  const data: ModelsDevData = await response.json();

  // 转换为我们需要的格式
  const models: Record<string, Model[]> = {};

  for (const [provider, providerData] of Object.entries(data)) {
    models[provider] = Object.entries(providerData.models).map(([id, model]) => ({
      id,
      displayName: model.name,
      contextWindow: model.context_length,
      supportsVision: model.supports_vision,
      supportsTools: model.supports_tools,
    }));
  }

  writeFileSync(
    join(__dirname, 'models.json'),
    JSON.stringify(models, null, 2)
  );

  console.log('Models synced successfully');
}

syncModels();
```

### 步骤 6：Agent 修改

Agent 接收 Provider 实例，不再直接依赖 Anthropic SDK：

```typescript
import type { Provider, Message, ChatOptions } from '../providers';

export class Agent {
  constructor(private provider: Provider) {}

  async run(messages: Message[], options: ChatOptions) {
    const response = await this.provider.chat(messages, options);

    // 处理响应...
    if (response.stop_reason === 'tool_use') {
      // 执行工具调用
      // 递归调用
    }

    return response;
  }

  async *stream(messages: Message[], options: ChatOptions) {
    for await (const chunk of this.provider.stream(messages, options)) {
      yield chunk;
    }
  }
}
```

## 测试计划

1. **单元测试**
   - 每个 Provider 的格式转换逻辑
   - 流式响应的缓冲和转换

2. **集成测试**
   - 端到端对话流程
   - 工具调用流程

3. **兼容性测试**
   - 确保现有 Agent 行为不变
   - 确保前端无需修改

## 依赖

- `@anthropic-ai/sdk` - Anthropic SDK
- `openai` - OpenAI SDK
- `@google/generative-ai` - Google Gemini SDK

## 风险和缓解

| 风险 | 缓解措施 |
|------|---------|
| 不同模型能力差异 | 在 models.json 中标记支持的功能 |
| 流式响应格式差异 | 使用混合模式，缓冲 tool_use |
| API 限流差异 | 在 Provider 层实现重试逻辑 |

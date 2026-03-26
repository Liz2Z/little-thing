# 多模型供应商支持 PRD

## 背景

当前系统仅支持 Anthropic Claude 模型。为了提供更大的灵活性，需要支持多种大模型供应商，包括 OpenAI、Google Gemini 等。

## 目标

- 支持多个大模型供应商（Anthropic、OpenAI、Gemini）
- 提供统一的 Agent 接口，屏蔽底层模型差异
- 前端可自由选择使用的供应商和模型

## 架构概述

```
前端请求 { provider: 'openai', model: 'gpt-4o' }
                    │
                    ▼
        ┌─────────────────────┐
        │    models.json      │  ← 从 models.dev 拉取的静态数据
        │  (provider 列表,    │
        │   models 元信息)    │
        └─────────────────────┘
                    │
                    ▼ 查找 provider 信息
                    │
        ┌─────────────────────┐
        │  初始化 Provider     │
        │  new XXXProvider()  │
        │  内置格式转换        │
        └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │      Session        │  ← 维护对话历史
        └─────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │      Agent          │  ← 无状态，执行对话循环
        └─────────────────────┘
```

## 核心设计决策

### 1. Provider 内置 Adapter

每个 Provider 内部负责将供应商原始格式转换为统一的 Anthropic Messages 格式。

**理由**：
- "如何调用 API"和"如何转换格式"是强耦合的
- 内置 Adapter 更内聚，减少抽象层次

### 2. 统一格式基于 Anthropic Messages

内部所有数据流使用 Anthropic Messages 格式。

**理由**：
- 项目核心是 Claude Agent
- Anthropic 格式的 tool use 设计清晰

### 3. 流式响应混合处理

| 内容类型 | 处理方式 |
|---------|---------|
| 文本内容 | 逐 chunk 实时转换 |
| 工具调用 | 缓冲完整后转换 |

**理由**：
- 文本实时性对用户体验重要
- tool_use 的 arguments 需要完整 JSON，缓冲是合理的

### 4. Provider 每次请求新实例

每次请求创建新的 Provider 实例。

**理由**：
- Provider 本身无状态
- 避免多请求间状态污染

## 数据来源

模型元信息从 [models.dev](https://github.com/anomalyco/models.dev) 拉取，存储为 `models.json`。

包含信息：
- provider 列表
- 每个 provider 支持的 models
- contextWindow、特性等元信息

## 接口定义

### Provider 接口

```typescript
interface Provider {
  // 基础信息
  readonly name: string;  // 'anthropic' | 'openai' | 'gemini'

  // 获取可用模型列表
  listModels(): Promise<Model[]>;

  // 一次性对话
  chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>;

  // 流式对话
  stream(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
}

interface Model {
  id: string;           // 'claude-3-opus-20240229'
  displayName: string;  // 'Claude 3 Opus'
  contextWindow: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

interface ChatOptions {
  model: string;
  maxTokens?: number;
  temperature?: number;
  system?: string;
  tools?: Tool[];
}
```

### 流式响应格式

```typescript
// 统一的流式 chunk 格式（基于 Anthropic）
interface StreamChunk {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_stop';
  index?: number;
  delta?: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  content_block?: {
    type: 'text' | 'tool_use';
    text?: string;
    name?: string;  // tool name
    id?: string;    // tool use id
  };
}
```

## 职责边界

| 组件 | 职责 |
|------|------|
| models.json | 静态模型元信息 |
| Provider | 调用供应商 API，转换格式 |
| Session | 维护对话历史 |
| Agent | 执行对话循环，处理工具调用 |

## 请求流程

1. 前端发送请求，携带 `provider` 和 `model`
2. 后端从 `models.json` 查找 provider 信息
3. 初始化对应的 Provider 实例
4. Session 提供对话历史
5. Agent 使用 Provider 执行任务
6. 返回响应（流式或一次性）

## 支持的供应商

| 供应商 | 接口风格 | 状态 |
|--------|---------|------|
| Anthropic | claude-messages | 必须支持 |
| OpenAI | openai-completion | 必须支持 |
| Google | gemini-generateContent | 必须支持 |

## 非功能性需求

- **性能**：流式文本响应延迟 < 100ms
- **可扩展性**：新增供应商只需实现 Provider 接口
- **兼容性**：现有 Agent 逻辑无需修改

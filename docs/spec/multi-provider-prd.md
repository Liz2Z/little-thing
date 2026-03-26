# 多模型供应商支持 PRD

## 背景

当前系统仅支持 Anthropic Claude 模型。为了提供更大的灵活性，需要支持多种大模型供应商。

## 目标

- 支持多个大模型供应商（Anthropic、OpenAI、Gemini 等）
- 前端可自由选择使用的供应商和模型

## 技术选型：Vercel AI SDK

**选择使用 `@ai-sdk/anthropic`、`@ai-sdk/openai` 等官方 provider 包，而不是自己实现 adapter。**

### 理由

1. **统一接口**：所有 provider 使用相同的 `streamText()` API，输出格式一致
2. **减少维护成本**：格式转换、流式处理由 SDK 处理，无需自己造轮子
3. **及时更新**：SDK 跟进各供应商 API 变化
4. **成熟稳定**：Vercel 团队维护，社区活跃

### 依赖

```
ai                    # 核心 SDK
@ai-sdk/anthropic     # Anthropic Claude
@ai-sdk/openai        # OpenAI GPT
@ai-sdk/google        # Google Gemini
```

## 核心设计决策

### 1. Provider 工厂模式

使用工厂函数 `createProvider(type, config)` 创建 provider 实例，支持：
- 根据 provider 类型自动选择对应的 SDK 包
- 支持自定义 baseUrl（兼容智谱等第三方 API）

### 2. 保持现有事件格式

内部继续使用现有的 `StreamChunk` 格式（`content_delta`、`thinking_delta`、`tool_use`、`done`），在 Provider 层将 AI SDK 的 `fullStream` 事件映射到此格式。

**理由**：避免修改 Agent 和前端代码。

### 3. 工具执行保留在 Agent 层

不使用 AI SDK 的 tool `execute` 函数，工具执行仍由 Agent 的 ToolExecutor 处理。

**理由**：保持现有架构，工具注册和执行逻辑不变。

### 4. Provider 每次请求新实例

每次请求创建新的 Provider 实例。

**理由**：Provider 无状态，避免多请求间状态污染。

## 支持的供应商

| 供应商 | AI SDK 包 | 状态 |
|--------|----------|------|
| Anthropic | `@ai-sdk/anthropic` | 必须 |
| OpenAI | `@ai-sdk/openai` | 必须 |
| Google | `@ai-sdk/google` | 可选 |
| 智谱 | `@ai-sdk/anthropic` (兼容模式) | 必须 |

> 智谱 API 兼容 Anthropic 格式，可通过自定义 baseUrl 使用 `@ai-sdk/anthropic`。

## 数据来源

模型元信息从 [models.dev](https://github.com/anomalyco/models.dev) 拉取，存储为 `models.json`。

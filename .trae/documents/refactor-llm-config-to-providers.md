# 重构计划：将 LLM 配置移至 providers 模块

## 问题分析

当前 `llmConfig` 在顶层 `index.ts` 中定义，然后逐层向下传递：
- `index.ts` → `routes/index.ts` → `routes/session.ts` / `routes/system.ts`

这违反了模块内聚原则：provider 特定的配置应该由 providers 模块自己管理。

## 重构方案

### 1. 创建 `providers/index.ts` 作为模块入口

创建工厂函数 `createProvider()`，内部读取环境变量并创建 provider 实例：
- 环境变量读取逻辑封装在 providers 模块内部
- 导出 provider 实例和相关配置（供需要的地方使用，如 health check）

### 2. 修改文件

#### 2.1 新建 `providers/index.ts`
```typescript
import { AnthropicProvider } from './anthropic.js';
import type { LLMConfig } from './types.js';

export function createProvider() {
  const config: LLMConfig = {
    apiKey: process.env.LLM_API_KEY || '',
    baseUrl: `${process.env.LLM_BASE_URL}/v1` || 'https://api.moonshot.cn/v1',
    model: process.env.LLM_MODEL || 'glm-4.7',
  };
  
  return {
    provider: new AnthropicProvider(config),
    config,
  };
}

export { AnthropicProvider } from './anthropic.js';
export type { LLMConfig } from './types.js';
```

#### 2.2 修改 `index.ts`
- 移除 `llmConfig` 定义
- 调用 `createProvider()` 获取 provider
- 不再传递 config 给 `registerAllRoutes`

#### 2.3 修改 `routes/index.ts`
- 移除 `CreateAppConfig` 接口
- 改为接收 `provider` 实例和 `config`（用于 health check 和 apiKey 检查）
- 或者让 provider 提供 `getConfig()` 方法

#### 2.4 修改 `routes/system.ts`
- 从 provider 获取 model 信息用于 health check

#### 2.5 修改 `routes/session.ts`
- 从 provider 获取 apiKey 状态用于错误检查

## 实施步骤

1. 创建 `providers/index.ts`，实现 `createProvider()` 工厂函数
2. 修改 `index.ts`，移除顶层配置，使用工厂函数
3. 修改 `routes/index.ts`，调整参数传递
4. 修改 `routes/system.ts`，从 provider 获取配置
5. 修改 `routes/session.ts`，从 provider 获取配置
6. 运行类型检查验证重构正确性

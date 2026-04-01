# AI 模块重构

## 背景

当前 Session 模块承担了过多的编排职责：直接依赖 providers、tools、agent 来组装 AI 能力。同时 Agent 反向依赖 Session 的 `convert.ts`，形成了不合理的耦合。需要引入一个 `ai` 模块作为组装层，让各模块职责更清晰。

## 现状问题

### Session 是实际上的"上帝模块"

Session 直接依赖 6 个模块，承担了不该它管的组装逻辑：

```
SessionService
  ├── import Agent          ← 创建实例
  ├── import createModel    ← 组装 model（应该不知道的细节）
  ├── import ToolExecutor   ← 传入 agent
  ├── import SessionStore   ← 合理
  ├── import Message        ← 合理
  └── import AgentEvent     ← 合理
```

`createAgent()` 方法里做了 model 创建 + Agent 实例化，Session 不应该关心"怎么创建 model"。

### Agent ↔ Session 的反向依赖

```
Agent import { toCoreMessages } from "../session/convert.js"
Agent import { Message, ToolParamValue } from "../session/message.js"
```

- `message.ts` 是纯类型协议，共享合理
- `convert.ts` 将 `Message[]` 转为 AI SDK 的 `ModelMessage[]`，这属于 AI 侧的职责，不该放在 Session 里

### toToolSet 逻辑内嵌在 Agent 中

`agent.ts` 里的 `toToolSet()` 把 `AnyTool[]` 包装成 AI SDK 要求的格式，这是组装逻辑而非 Agent 核心职责。

## 目标

1. 新增 `ai` 模块，承担 model 创建、toolSet 组装、Agent 实例化
2. Session 不再直接依赖 providers 和 agent，改为依赖 ai 模块
3. `convert.ts` 从 Session 搬到 ai 模块
4. Tools 模块保持独立，可单独使用和测试
5. Agent 不再 import Session 的任何东西

## 模块依赖关系

### 重构前

```
Session ──→ Agent ──→ session/convert, session/message  (反向依赖！)
  ├──→ providers/factory
  ├──→ tools/registry
  ├──→ storage
  └──→ settings
```

### 重构后

```
Session ──→ ai ──→ Agent
  │            ├──→ providers/factory
  │            ├──→ tools/registry
  │            └──→ convert (从 session 搬入)
  ├──→ storage
  └──→ errors
```

## 模块职责定义

### ai 模块（新增）

**职责**：组装 AI 能力，对外暴露简洁的对话接口。

```typescript
// packages/server/src/ai/service.ts

interface ChatOptions {
  enabledTools?: string[];
  provider: string;
  model: string;
  abortSignal?: AbortSignal;
}

interface AIService {
  chat(
    message: string,
    messages: Message[],
    options: ChatOptions,
  ): AsyncGenerator<AgentEvent>;

  abort(runId: string): boolean;
}
```

**内部负责**：
- 调用 `createModel()` 创建 model 实例
- 调用 `toCoreMessages()` 转换消息格式
- 调用 `toToolSet()` 组装工具集
- 创建 Agent 实例并执行
- 管理活跃的 run（abort 能力）

**文件结构**：
```
packages/server/src/ai/
  ├── service.ts      # AIService 实现
  ├── convert.ts      # toCoreMessages（从 session/ 搬入）
  └── index.ts        # 导出
```

### Agent 模块（瘦身）

**变化**：
- 移除对 `session/convert` 和 `session/message` 的 import
- `toToolSet()` 从 agent.ts 移出到 ai 模块
- 构造函数改为接收已准备好的 `toolSet`（`Record<string, any>`），不再接收 `ToolExecutor`
- `run()` 方法接收 `ModelMessage[]` 而非 `Message[]`

**重构后的 Agent 构造函数**：

```typescript
class Agent {
  constructor(private model: any) {}

  async *run(
    message: string,
    messages: ModelMessage[],     // 直接接收 AI SDK 格式
    toolSet: Record<string, any>, // 已组装好的工具集
    options: RunOptions,
  ): AsyncGenerator<AgentEvent> {
    // ...
  }
}
```

Agent 只依赖：
- `ai` SDK（streamText）
- `agent/events.ts`（事件类型）
- `agent/context.ts`（运行上下文）

### Session 模块（瘦身）

**移除**：
- 不再 import `Agent`
- 不再 import `createModel`
- 不再直接 import `ToolExecutor`（chat 场景）

**新增**：
- import `AIService`

**SessionService 构造函数变化**：

```typescript
// 前
constructor(
  private sessionStore: SessionStore,
  private toolExecutor: ToolExecutor,
)

// 后
constructor(
  private sessionStore: SessionStore,
  private aiService: AIService,
)
```

`chat()` 方法变化：

```typescript
// 前：Session 自己创建 Agent、组装一切
const agent = this.createAgent(provider, model);
for await (const event of agent.run(message, session.messages, { ... })) { ... }

// 后：委托给 ai 模块
for await (const event of this.aiService.chat(message, session.messages, {
  provider, model, enabledTools: options?.enabledTools,
})) { ... }
```

### Tools 模块（不变）

保持独立，不挪入 ai 模块：
- `ToolRegistry`、`ToolExecutor` 接口、单个 tool 定义均不动
- ai 模块通过 `ToolExecutor` 接口引用 tools
- 如果未来有非 Agent 场景需要直接使用 tool，不受 ai 模块影响

### convert.ts（搬迁）

从 `packages/server/src/session/convert.ts` 整体移到 `packages/server/src/ai/convert.ts`。

**清理**：
- `toCoreMessages` → 保留，搬入 ai 模块
- `getTextContent`（MessageContent 版）→ 删除，无任何消费者
- `getTextContent`（ToolExecutionResult 版，在 `tools/types.ts`）→ 不动

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `packages/server/src/ai/service.ts` | AIService 实现 |
| 新增 | `packages/server/src/ai/index.ts` | 导出 |
| 搬迁 | `session/convert.ts` → `ai/convert.ts` | 删除未使用的 getTextContent |
| 修改 | `agent/agent.ts` | 瘦身：接收 ModelMessage[] 和 toolSet |
| 修改 | `session/service.ts` | 改为依赖 AIService |
| 删除 | `packages/server/src/agent/ai.ts` | 空文件 |
| 修改 | 路由层 / index.ts | 更新依赖注入 |

## 实施步骤

1. **创建 ai 模块骨架**：`ai/service.ts`、`ai/convert.ts`、`ai/index.ts`
2. **搬入 convert.ts**：移动 `toCoreMessages`，删除 `getTextContent`
3. **实现 AIService**：将 SessionService 中的 `createAgent` + Agent 组装逻辑移入
4. **瘦身 Agent**：改构造函数和 `run()` 签名，移除 session 依赖
5. **瘦身 Session**：改为依赖 AIService
6. **更新入口**：修改 index.ts 中的依赖注入
7. **验证**：运行现有测试确保行为不变

## 风险与注意事项

- **渐进式重构**：每一步都应该能通过现有测试，不要一次性改完
- **ToolExecutor 仍然被 Session 需要**：如果 Session 的非 chat 功能（如列出可用 tools）需要 ToolExecutor，Session 可以继续依赖它，但 chat 路径走 ai 模块
- **Agent 事件类型**：Session 仍然需要 import `AgentEvent` 来做类型判断（`agent_complete`、`agent_error`），考虑是否需要将事件类型移到独立位置

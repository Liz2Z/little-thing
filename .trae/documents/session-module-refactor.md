# Session 模块重构计划

## 背景

当前 `routes/session.ts` 存在以下问题：

1. **Controller + Service 融合**：路由定义与业务逻辑混在一起
2. **依赖实例化位置不当**：Agent、Provider、ToolRegistry、SessionStore 在路由文件顶层实例化
3. **职责不清**：路由处理函数中包含业务逻辑

## 目标

将逻辑拆分到 `session/` 模块中，作为独立的 session service，遵循项目现有的模块组织模式。

## 重构方案

### 目录结构变更

```
session/
├── index.ts          # 模块导出（仅导出 SessionService 和类型）
├── store.ts          # SessionStore（保持不变，不对外导出）
├── types.ts          # 类型定义（保持不变）
└── service.ts        # 新增：SessionService 业务逻辑 + 依赖初始化
```

### 文件职责划分

| 文件                   | 职责                        | 对外可见性                   |
| -------------------- | ------------------------- | ---------------------- |
| `session/service.ts` | 封装业务逻辑 + 依赖初始化            | 导出 `SessionService` 和 `createSessionService` |
| `session/store.ts`   | 数据持久化                     | **不导出**，作为内部实现         |
| `session/types.ts`   | 类型定义                      | 导出类型                   |
| `routes/session.ts`  | 仅负责路由定义、请求验证、响应格式化        | 导出路由                   |

### 依赖注入方案

采用**工厂函数模式**，在 `session/service.ts` 中封装所有依赖的创建：

```typescript
// session/service.ts
import { SessionStore } from './store.js';
import { Agent } from '../agent/agent.js';
import { AnthropicProvider } from '../providers/anthropic.js';
import { ToolRegistry, createAllTools } from '../tools/index.js';

export class SessionService {
  constructor(
    private sessionStore: SessionStore,
    private agent: Agent
  ) {}

  // 业务方法...
}

export function createSessionService(cwd: string): SessionService {
  const sessionStore = new SessionStore();
  
  const provider = new AnthropicProvider();
  const toolRegistry = new ToolRegistry();
  const allTools = createAllTools(cwd);
  for (const tool of Object.values(allTools)) {
    toolRegistry.register(tool);
  }
  const agent = new Agent(provider, toolRegistry);
  
  return new SessionService(sessionStore, agent);
}
```

### 实现步骤

#### Step 1: 创建 `session/service.ts`

创建 `SessionService` 类，封装以下业务逻辑：

```typescript
export class SessionService {
  // 会话管理
  listSessions(): SessionMeta[]
  getSession(id: string): Session | null
  createSession(name?: string): SessionMeta
  deleteSession(id: string): boolean
  renameSession(id: string, name: string): boolean

  // 消息操作
  addMessage(sessionId: string, message: Omit<Message, 'id'>): boolean

  // 会话分支
  forkSession(sessionId: string, messageId: string, name?: string): SessionMeta | null
  resumeSession(sessionId: string, messageId: string): boolean

  // Agent 对话
  async *chat(sessionId: string, message: string, options?: ChatOptions): AsyncGenerator<AgentEvent>

  // Agent 控制
  abort(runId: string): void
}
```

#### Step 2: 创建 `session/index.ts`

仅导出对外接口，**不导出 SessionStore**：

```typescript
export { SessionService, createSessionService } from './service.js';
export type { Session, SessionMeta, Message } from './types.js';
```

#### Step 3: 重构 `routes/session.ts`

1. 移除顶层的所有依赖实例化
2. 使用 `createSessionService(process.cwd())` 创建服务实例
3. 路由处理函数仅调用 SessionService 方法
4. 保持 OpenAPI 文档定义不变

```typescript
// routes/session.ts
import { createSessionService } from '../session/index.js';

const sessionService = createSessionService(process.cwd());

const app = new Hono();

app.get('/', (c) => {
  const sessions = sessionService.listSessions();
  return c.json({ sessions });
});
// ...
```

## 变更影响

* **无破坏性变更**：API 接口保持不变

* **测试影响**：如有测试，需更新 mock 方式

* **其他模块**：无影响

## 预期收益

1. **职责清晰**：路由层仅处理 HTTP，业务逻辑在 Service 层
2. **封装性好**：SessionStore 作为内部实现不暴露
3. **可测试性**：可通过 mock SessionService 测试路由层
4. **可复用性**：SessionService 可被其他模块复用
5. **符合项目规范**：遵循现有的模块内聚模式


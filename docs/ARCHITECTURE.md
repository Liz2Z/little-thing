## 整体架构

```
┌─────────────┐                    ┌─────────────┐
│  CLI (TUI)  │                    │ Web (浏览器) │
└──────┬──────┘                    └──────┬──────┘
      │                                  │
      │ HTTP API                         │ HTTP API + SSE
      │                                  │
      └──────────────┬───────────────────┘
                     │
         ┌───────────┴───────────┐
         │       Server          │
         │  ┌─────────────────┐  │
         │  │   Event Bus     │  │
         │  │  (事件系统)      │  │
         │  └────────┬────────┘  │
         │           │           │
         │  ┌────────┴────────┐  │
         │  │   SSE Manager   │  │
         │  │  (实时推送)      │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │   Agent Core    │  │
         │  │   (LLM调用)      │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │   Tool System   │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │  Session Store  │  │
         │  └─────────────────┘  │
         └───────────────────────┘
```

## Package 职责

| Package           | 职责                                           | 技术栈                                |
| ----------------- | ---------------------------------------------- | ------------------------------------- |
| `packages/server` | 核心引擎：LLM 通信、工具调用、会话管理、事件系统 | Bun + Hono + hono-openapi + SSE       |
| `packages/cli`    | 命令行客户端：交互式对话、会话管理命令         | Bun + `readline` (后期可接 `ink` TUI) |
| `packages/web`    | Web 客户端：聊天界面、会话列表、实时事件       | React + Vite + Zustand + SSE          |
| `packages/sdk`    | SDK：类型安全的 API 客户端、事件客户端         | TypeScript + openapi-typescript       |

## 通信协议

### HTTP API (CLI & Web)

```
POST /sessions              - 创建会话
GET  /sessions              - 获取会话列表
GET  /sessions/:id          - 获取会话详情
PUT  /sessions/:id          - 重命名会话
DELETE /sessions/:id        - 删除会话
POST /sessions/:id/chat     - 发送消息 (同步)
POST /sessions/:id/chat/stream - 发送消息 (流式)
POST /chat                  - 无会话聊天
POST /chat/stream           - 无会话流式聊天
```

### SSE 事件流 (Web)

```
GET /events?sessionId=xxx   - 建立 SSE 连接
```

#### 事件类型

| 事件类型              | 说明           | Payload                              |
| --------------------- | -------------- | ------------------------------------ |
| `session:created`     | 会话创建       | `{ sessionId, name, createdAt }`     |
| `session:deleted`     | 会话删除       | `{ sessionId }`                      |
| `session:updated`     | 会话更新       | `{ sessionId, name?, updatedAt }`    |
| `message:received`    | 收到新消息     | `{ sessionId, role, content, timestamp }` |
| `chat:stream`         | 聊天流式响应   | `{ sessionId, delta, done }`         |
| `chat:complete`       | 聊天完成       | `{ sessionId, content, usage? }`     |
| `error`               | 错误           | `{ code?, message, sessionId? }`     |

## 事件系统

### 架构设计

事件系统采用发布-订阅模式，所有后端产生的数据变化都通过事件总线发布，前端通过 SSE 连接订阅事件。

```
┌──────────────┐     publish      ┌──────────────┐
│  Route/Agent │ ───────────────> │  Event Bus   │
└──────────────┘                  └──────┬───────┘
                                         │
                                    subscribe
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  SSE Manager │
                                  └──────┬───────┘
                                         │
                                    push event
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │  Web Client  │
                                  └──────────────┘
```

### 使用示例

#### 后端发布事件

```typescript
import { broadcastEvent, createEvent, EventType } from './events';

broadcastEvent(createEvent(
  EventType.SESSION_CREATED,
  { sessionId: '123', name: 'New Session', createdAt: new Date().toISOString() },
  '123'
));
```

#### 前端订阅事件

```typescript
import { useSSE, useEvent, EventType } from '@agent/sdk';

function MyComponent() {
  const { status } = useSSE();
  
  useEvent(EventType.SESSION_CREATED, (event) => {
    console.log('新会话创建:', event.payload.name);
  });
  
  return <div>连接状态: {status}</div>;
}
```

## OpenAPI 与 SDK 生成

### 路由定义

使用 `hono-openapi` 定义路由，每个路由声明 `operationId` 作为 SDK 调用链的标识：

```typescript
const getSessionRoute = createRoute({
  method: 'get',
  path: '/sessions/{id}',
  operationId: 'sessions.get',  // SDK: api.sessions.get(id)
  summary: '获取会话详情',
  // ...
});
```

### SDK 调用链映射

| operationId              | SDK 调用方式                    |
| ------------------------ | ------------------------------- |
| `health.check`           | `api.health.check()`            |
| `sessions.list`          | `api.sessions.list()`           |
| `sessions.create`        | `api.sessions.create(body)`     |
| `sessions.get`           | `api.sessions.get(id)`          |
| `sessions.delete`        | `api.sessions.delete(id)`       |
| `sessions.rename`        | `api.sessions.rename(id, body)` |
| `sessions.messages.add`  | `api.sessions.messages.add(id, body)` |
| `sessions.chat`          | `api.sessions.chat(id, body)`   |
| `sessions.chat.stream`   | `api.sessions.chat.stream(id, body)` |
| `chat.send`              | `api.chat.send(body)`           |
| `chat.stream`            | `api.chat.stream(body)`         |

### SDK 生成

```bash
bun run generate:sdk
```

此命令会：
1. 从服务器获取 OpenAPI schema
2. 生成 TypeScript 类型定义 (`schema.d.ts`)
3. 根据 operationId 生成语义化的 SDK 客户端 (`generated.ts`)

## Monorepo 结构

```bash
little-thing/
├── packages/
│   ├── server/          # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts      # 服务入口
│   │   │   ├── routes.ts     # OpenAPI 路由定义
│   │   │   ├── events/       # 事件系统
│   │   │   │   ├── index.ts  # 事件入口
│   │   │   │   ├── types.ts  # 事件类型定义
│   │   │   │   ├── bus.ts    # 事件总线
│   │   │   │   └── sse.ts    # SSE 端点
│   │   │   ├── agent/        # Agent 核心
│   │   │   ├── tools/        # 工具注册/执行
│   │   │   ├── session/      # 会话管理
│   │   │   └── providers/    # LLM 提供商
│   │   └── package.json
│   │
│   ├── cli/             # 命令行客户端
│   │   ├── src/
│   │   │   ├── index.ts      # CLI 入口
│   │   │   ├── chat.ts       # 交互式对话
│   │   │   └── api.ts        # server API 封装
│   │   └── package.json
│   │
│   ├── web/             # Web 客户端
│   │   ├── src/
│   │   │   ├── App.tsx       # 应用入口
│   │   │   ├── hooks/        # 自定义 Hooks
│   │   │   │   └── useServerEvent.ts # 服务器事件 Hook
│   │   │   ├── stores/       # 状态管理
│   │   │   │   └── eventStore.ts # 事件状态
│   │   │   └── api/          # API 客户端
│   │   └── package.json
│   │
│   └── sdk/             # SDK
│       ├── src/
│       │   ├── index.ts      # SDK 入口
│       │   ├── generated.ts  # 自动生成的 API 客户端
│       │   ├── schema.d.ts   # OpenAPI 类型定义
│       │   ├── events.ts     # SSE 客户端
│       │   └── event-types.ts # 事件类型定义
│       ├── scripts/
│       │   └── generate.ts   # SDK 生成脚本
│       └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md       # 架构文档
│   ├── UI-DESIGN.md          # UI 设计规范
│   └── ai-guidelines.md      # AI 开发规范
│
├── bunfig.toml          # Bun workspace 配置
└── package.json         # Root workspace
```

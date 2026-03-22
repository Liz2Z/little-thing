# Routes 分层重构 Spec

## Why
当前 `routes.ts` 文件约 775 行，路由定义、业务逻辑全部混在一起，结构不清晰，难以维护。需要按功能模块拆分，每个模块独立管理自己的路由和业务逻辑。

## What Changes
- 按功能模块拆分代码
- 每个模块独立管理路由、业务逻辑和 Schema
- 每个模块有独立的路由文件
- **删除 chat 相关路由**（无会话聊天、流式聊天）
- **Agent 路由归属到 session 模块**
- **system 路由直接放在 routes/system.ts，不需要独立模块**

## Impact
- Affected code: `packages/server/src/routes.ts`
- New directories: `session/`, `routes/`

## ADDED Requirements

### Requirement: 模块化组织
系统 SHALL 按功能模块组织代码，每个模块独立管理路由、业务逻辑和 Schema

#### Scenario: 模块划分
- **WHEN** 组织代码结构时
- **THEN** 按以下模块划分：
  - `session` 模块：会话管理 + Agent 对话相关
  - `system` 路由：健康检查、OpenAPI、SSE 事件（逻辑简单，直接在路由文件中处理）

#### Scenario: 模块职责
- **WHEN** 开发新功能时
- **THEN** 相关的路由定义、业务逻辑、Schema 都在对应模块内

### Requirement: 路由文件独立
系统 SHALL 将路由声明放到独立的路由文件中

#### Scenario: 路由文件组织
- **WHEN** 定义路由时
- **THEN** 路由声明放在 `routes/` 目录下的独立文件中

## REMOVED Requirements

### Requirement: Chat 路由
**Reason**: 不再需要无会话聊天功能，Agent 模式已满足需求
**Migration**: 删除以下路由：
- `POST /chat`
- `POST /chat/stream`
- `POST /sessions/:id/chat/stream`

## 目录结构

```
packages/server/src/
├── routes/           # 路由定义
│   ├── index.ts      # 合并所有路由
│   ├── session.ts    # 会话 + Agent 路由
│   └── system.ts     # 系统路由（逻辑简单，直接处理）
├── session/          # 会话模块（业务逻辑）
│   └── index.ts
├── agent/            # Agent 模块（已存在，核心逻辑）
└── routes.ts         # 入口，创建 app 并注册路由
```

# Tasks

- [x] Task 1: 实现后端事件系统
  - [x] SubTask 1.1: 创建事件类型定义 (`packages/server/src/events/types.ts`)
  - [x] SubTask 1.2: 实现事件总线 (`packages/server/src/events/bus.ts`)
  - [x] SubTask 1.3: 实现 SSE 端点 (`packages/server/src/events/sse.ts`)

- [x] Task 2: 重构路由为 hono-openapi
  - [x] SubTask 2.1: 安装 hono-openapi 依赖
  - [x] SubTask 2.2: 创建 OpenAPI 路由基础结构
  - [x] SubTask 2.3: 迁移 sessions 相关路由
  - [x] SubTask 2.4: 迁移 chat 相关路由
  - [x] SubTask 2.5: 添加 operationId 元数据

- [x] Task 3: 更新 SDK 生成逻辑
  - [x] SubTask 3.1: 更新 OpenAPI schema 生成脚本
  - [x] SubTask 3.2: 实现 operationId 到调用链的转换
  - [x] SubTask 3.3: 生成类型安全的 SDK 客户端

- [x] Task 4: 实现前端 SSE 客户端
  - [x] SubTask 4.1: 创建 SSE 连接管理器
  - [x] SubTask 4.2: 实现事件派发器
  - [x] SubTask 4.3: 集成到 React 应用

- [x] Task 5: 更新架构文档
  - [x] SubTask 5.1: 更新 ARCHITECTURE.md 添加事件系统说明
  - [x] SubTask 5.2: 添加 SDK 调用规范

# Task Dependencies
- [Task 2] depends on [Task 1] - 路由重构需要事件系统支持
- [Task 3] depends on [Task 2] - SDK 生成需要新的 OpenAPI 结构
- [Task 4] depends on [Task 1] - 前端 SSE 客户端需要后端 SSE 端点

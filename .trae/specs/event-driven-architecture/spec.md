# 事件驱动架构与增强型 OpenAPI 集成 Spec

## Why
当前架构使用 HTTP 请求-响应模式，前端需要轮询或为每个操作发起新请求。引入事件驱动架构可以实现实时数据推送，同时增强 OpenAPI 集成可以提供更好的类型安全、参数校验和 SDK 生成体验。

## What Changes
- 实现系统级别的事件系统，所有后端发给前端的数据都以事件方式发送
- Web 端建立 SSE (Server-Sent Events) 长连接，后端通过此连接推送事件
- 使用 `hono-openapi` 重构路由，支持参数校验和自动文档生成
- 每个路由声明 `sdkId`，用于生成语义化的 SDK 调用链

## Impact
- Affected specs: 通信协议、SDK 生成、前后端交互模式
- Affected code:
  - `packages/server/src/routes.ts` - 重构为 hono-openapi
  - `packages/server/src/events/` - 新增事件系统
  - `packages/sdk/` - SDK 生成逻辑更新
  - `packages/web/src/` - SSE 连接与事件处理

## ADDED Requirements

### Requirement: 事件系统
系统 SHALL 提供系统级别的事件系统，支持事件的发布、订阅和派发。

#### Scenario: 事件发布
- **WHEN** 后端产生数据需要推送给前端
- **THEN** 系统通过事件总线发布事件，包含事件类型和载荷

#### Scenario: 事件订阅
- **WHEN** 前端通过 SSE 连接订阅事件
- **THEN** 系统将事件实时推送给订阅者

### Requirement: SSE 长连接
Web 客户端 SHALL 通过 Hono 的 streamSSE 建立与服务器的长连接。

#### Scenario: 建立连接
- **WHEN** Web 应用初始化
- **THEN** 自动建立 SSE 连接 `/events`

#### Scenario: 事件接收与派发
- **WHEN** 前端收到 SSE 事件
- **THEN** 根据事件类型派发给对应的监听器

#### Scenario: 连接断开重连
- **WHEN** SSE 连接断开
- **THEN** 自动尝试重新连接

### Requirement: hono-openapi 路由
服务器路由 SHALL 使用 hono-openapi 定义，支持参数校验和自动文档生成。

#### Scenario: 路由定义
- **WHEN** 定义一个 API 路由
- **THEN** 使用 OpenAPI 规范描述请求参数、响应格式

#### Scenario: 参数校验
- **WHEN** 请求参数不符合规范
- **THEN** 返回 400 错误并包含详细的校验错误信息

### Requirement: SDK ID 映射
每个路由 SHALL 声明 sdkId，用于生成语义化的 SDK 调用链。

#### Scenario: SDK 调用链生成
- **GIVEN** 路由 `/sessions/:id` 的 sdkId 为 `sessions.get`
- **WHEN** 生成 SDK
- **THEN** 前端可以调用 `sdk.sessions.get("session-id")`

#### Scenario: 嵌套路径映射
- **GIVEN** 路由 `/sessions/:id/messages` 的 sdkId 为 `sessions.messages.list`
- **WHEN** 生成 SDK
- **THEN** 前端可以调用 `sdk.sessions.messages.list("session-id")`

## MODIFIED Requirements

### Requirement: 通信协议
原有 HTTP API 保留，新增 SSE 事件通道。

```
CLI ↔ Server: HTTP API (保留)
Web ↔ Server: HTTP API + SSE 事件流
```

### Requirement: OpenAPI 文档
OpenAPI 文档从手动定义改为 hono-openapi 自动生成，包含更完整的参数校验信息。

## REMOVED Requirements
无

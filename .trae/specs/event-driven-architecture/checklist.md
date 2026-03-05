# Checklist

## 事件系统
- [x] 事件类型定义完整，包含所有需要的事件类型
- [x] 事件总线支持发布/订阅模式
- [x] SSE 端点正确处理连接和断开
- [x] SSE 端点支持心跳保活

## hono-openapi 集成
- [x] 所有路由使用 hono-openapi 定义
- [x] 请求参数校验正常工作
- [x] OpenAPI 文档自动生成正确
- [x] 每个路由都有 operationId 元数据

## SDK 生成
- [x] SDK 调用链符合 operationId 定义
- [x] SDK 类型安全，无 any 类型
- [x] SDK 包含所有 API 端点

## 前端 SSE 集成
- [x] SSE 连接在应用启动时自动建立
- [x] 事件正确派发给监听器
- [x] 断线重连机制正常工作
- [x] 组件可以订阅/取消订阅事件

## 文档更新
- [x] ARCHITECTURE.md 包含事件系统说明
- [x] 通信协议图更新

# 后端开发规范

## 技术栈

| 技术 | 用途 |
|------|------|
| Bun | Runtime |
| Hono | HTTP 框架 |
| WebSocket | 实时通信 |

## 决定

- 优先 'hono' 搭配 'hono-openapi' 构建 API 服务
- 绝对不要手动修改 @littlething/sdk 中的代码
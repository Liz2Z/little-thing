# 后端开发规范

## 技术栈

| 技术        | 用途      |
| --------- | ------- |
| Bun       | Runtime |
| Hono      | HTTP 框架 |
| WebSocket | 实时通信    |

## 决定

- 优先 'hono' 搭配 'hono-openapi' 构建 API 服务
- 绝对不要手动修改 @littlething/sdk 中的代码
- SSE 用于实时事件推送，全局唯一，为公共服务，绝对不要为了某个需求修改
- agent/ 不能依赖任何 session/ 中的模块
- ai sdk 只能被用在 agent/ 和 providers/ 模块内


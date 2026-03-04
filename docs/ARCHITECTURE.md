## 整体架构

┌─────────────┐ ┌─────────────┐
│ CLI (TUI) │ │ Web (浏览器) │
└──────┬──────┘ └──────┬──────┘
│ │
└─────────┬─────────┘
│ WebSocket/HTTP
┌─────────┴─────────┐
│ Server │
│ ┌─────────────┐ │
│ │ Agent Core │ │
│ │ (LLM调用) │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Tool System │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │Session Store│ │
│ └─────────────┘ │
└───────────────────┘

## Package 职责

| Package           | 职责                                           | 技术栈                                |
| ----------------- | ---------------------------------------------- | ------------------------------------- |
| `packages/server` | 核心引擎：LLM 通信、工具调用、会话管理、持久化 | Bun + Hono/WebSocket                  |
| `packages/cli`    | 命令行客户端：交互式对话、会话管理命令         | Bun + `readline` (后期可接 `ink` TUI) |
| `packages/web`    | Web 客户端：聊天界面、会话列表                 | 待定 (先留位置)                       |

## 通信协议

CLI ↔ Server: HTTP API (简洁)

- POST /chat - 发送消息
- GET /sessions - 获取会话列表
- WebSocket /stream - 流式输出（后续）

## Monorepo 结构

```bash
little-thing/
├── packages/
│   ├── server/          # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts      # 服务入口
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
│   └── web/             # Web 客户端（预留）
│       └── package.json
│
├── bunfig.toml          # Bun workspace 配置
└── package.json         # Root workspace
```

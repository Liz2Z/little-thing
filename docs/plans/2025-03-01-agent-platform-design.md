# Agent Platform 设计文档

## 目标

构建一个通用型 LLM Agent 平台，支持多客户端（CLI/Web）和可扩展的工具系统。

## 架构

```
┌─────────────┐     ┌─────────────┐
│  CLI (TUI)  │     │  Web (浏览器) │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └─────────┬─────────┘
                 │ HTTP / WebSocket
       ┌─────────┴─────────┐
       │      Server       │
       │  ┌─────────────┐  │
       │  │  Agent Core │  │  ← LLM 调用、消息处理
       │  └─────────────┘  │
       │  ┌─────────────┐  │
       │  │  Tool System │  │  ← 工具注册、执行
       │  └─────────────┘  │
       │  ┌─────────────┐  │
       │  │Session Store│  │  ← 会话持久化
       │  └─────────────┘  │
       └───────────────────┘
```

## Monorepo 结构

```
little-thing/
├── packages/
│   ├── server/     # 核心服务：LLM、工具、会话
│   ├── cli/        # 命令行客户端
│   └── web/        # Web 客户端（预留）
├── bunfig.toml     # Bun workspace 配置
└── package.json    # Root workspace
```

## Package 职责

### packages/server

- HTTP API 服务 (Hono)
- LLM Provider（Anthropic 格式，支持 GLM/Kimi）
- 消息处理与流式输出
- 会话管理（内存存储 → 后续持久化）
- 工具系统（预留接口）

### packages/cli

- 连接配置（API key、base URL、model）
- 交互式对话模式
- 会话列表/切换命令
- 流式输出显示

### packages/web

- 预留 package，后续实现聊天界面

## LLM 接口

使用 Anthropic Messages API 格式：

```typescript
POST /v1/messages
{
  "model": "claude-3-5-sonnet",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": true,
  "tools": [...]  // 后续支持
}
```

支持后端：
- 智谱 GLM: `https://open.bigmodel.cn/api/paas/v4`
- Moonshot Kimi: `https://api.moonshot.cn/v1`

## 迭代计划

### Phase 1: 基础对话
- [ ] Server: HTTP 服务 + `/chat` endpoint
- [ ] Server: Anthropic 格式 LLM 调用
- [ ] CLI: 配置管理
- [ ] CLI: 交互式对话
- [ ] CLI: 流式输出显示

### Phase 2: 会话管理
- [ ] Server: 会话 CRUD API
- [ ] Server: 消息历史存储
- [ ] CLI: 会话列表/创建/切换命令

### Phase 3: 工具系统
- [ ] Server: 工具注册机制
- [ ] Server: 工具执行循环
- [ ] Server: 内置基础工具

### Phase 4: Web 界面
- [ ] Web: 聊天界面
- [ ] Web: 会话管理
- [ ] Web: 流式显示

## 技术栈

- **Runtime**: Bun
- **Server**: Hono (HTTP) + 原生 WebSocket
- **CLI**: readline (TUI 后续可选 ink/blessed)
- **Web**: 待定
- **LLM**: fetch 直接调用 Anthropic 兼容接口

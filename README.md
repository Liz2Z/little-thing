# little thing

基于 LLM 的智能助手平台，核心形态是 `thing` CLI（含 TUI 与 `server` 子命令）。

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 3. 启动

```bash
# 启动 thing（默认入口，当前为 TUI 占位）
bun run dev


# 按需启动 Web UI
bun run dev:web
```

默认服务地址：

- HTTP API: `http://localhost:3000`
- OpenAPI: `http://localhost:3000/openapi.json`
- Web UI: `http://localhost:5173`

## 项目结构

```text
packages/
├── thing/    # CLI 一等包（TUI + server 子命令 + 核心能力）
├── web/      # Web 用户界面
└── sdk/      # 基于 OpenAPI 生成的客户端 SDK
```

`packages/thing/src` 采用平铺能力模块：`cli/`、`server/`、`routes/`、`agent/`、`session/`、`providers/`、`settings/`、`tools/`、`events/`、`storage/`、`lib/`。

## 数据存储

按 XDG 规范存储：

- 配置：`~/.config/littlething/config.json`
- 数据：`~/.local/share/littlething/sessions/`

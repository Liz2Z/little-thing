# little thing

基于 LLM 的智能助手平台，核心形态是 `thing` CLI（含 TUI 与 `server` 子命令）。

## 快速开始

### 1. 配置环境变量

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.moonshot.cn/v1"  # 或 GLM: https://open.bigmodel.cn/api/paas/v4
export LLM_MODEL="kimi-k2.5"
```

### 2. 安装依赖

```bash
bun install
```

### 3. 启动

```bash
# 启动 thing（默认入口，当前为 TUI 占位）
bun run dev

# 单独启动 HTTP 服务（给 Web UI / SDK 使用）
thing server

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

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | API 密钥 | - |
| `LLM_BASE_URL` | API 基础地址 | `https://api.moonshot.cn/v1` |
| `LLM_MODEL` | 模型名称 | `kimi-k2.5` |
| `PORT` | 服务端口 | `3000` |

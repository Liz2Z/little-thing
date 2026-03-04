# little thing

基于 LLM 的智能助手平台，支持 CLI 和 Web 客户端。

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

### 3. 启动服务

```bash
# 同时启动 Server 和 Web UI
bun run dev

# 或者分别启动
bun run dev:server  # HTTP API 服务器 (http://localhost:3000)
bun run dev:web     # Web UI (http://localhost:5173)
bun run dev:cli     # 命令行客户端
```

访问 http://localhost:5173 使用 Web UI。

## 项目结构

```
packages/
├── server/    # HTTP API 服务器（LLM、工具、会话管理）
├── cli/       # 命令行客户端
└── web/       # Web 用户界面
```

## Web UI 功能

- 多会话管理
- 实时流式聊天
- 响应式设计（支持移动端）
- 配置管理（API 地址、API Key、模型选择）

## CLI 客户端

### 交互式命令

在聊天中输入：
- `/new [name]` - 创建新会话
- `/list` - 列出所有会话
- `/switch <id>` - 切换到指定会话
- `/delete <id>` - 删除会话
- `/rename <name>` - 重命名当前会话
- `/clear` - 清屏
- `/quit` - 退出

### 命令行操作

```bash
# 列出所有会话
lt sessions list

# 创建新会话
lt sessions new "代码调试"

# 切换到会话
lt sessions switch 20250301-abc123

# 删除会话
lt sessions delete 20250301-abc123
```

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

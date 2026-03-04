# Phase 1: 基础对话实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建 little thing monorepo 结构，实现 server 基础 HTTP 服务和 CLI 交互式对话，支持 Anthropic 格式的 LLM 调用和流式输出。

**Architecture:** Server 使用 Hono 提供 HTTP API，CLI 使用 readline 实现交互式终端，两者通过 HTTP 通信。LLM 调用直接使用 fetch 对接 Anthropic 兼容接口（GLM/Kimi）。

**Tech Stack:** Bun + Hono + TypeScript

---

### Task 1: 设置 Monorepo 结构

**Files:**

- Modify: `package.json`
- Create: `bunfig.toml`
- Create: `packages/server/package.json`
- Create: `packages/cli/package.json`
- Create: `packages/web/package.json`

**Step 1: 更新根 package.json**

```json
{
  "name": "agent-platform",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:server": "bun run --filter server dev",
    "dev:cli": "bun run --filter cli dev",
    "build": "bun run --filter '*' build",
    "test": "bun test"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

**Step 2: 创建 bunfig.toml**

```toml
[install]
registry = "https://registry.npmjs.org"
```

**Step 3: 创建 packages/server/package.json**

```json
{
  "name": "@littlething/server",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "hono": "^4"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

**Step 4: 创建 packages/cli/package.json**

```json
{
  "name": "@littlething/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "lt": "./dist/index.js"
  },
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@littlething/sdk": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5"
  }
}
```

**Step 5: 创建 packages/web/package.json**

```json
{
  "name": "@littlething/web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "echo 'Web client not implemented yet'",
    "build": "echo 'Web client not implemented yet'"
  }
}
```

**Step 6: 创建目录结构**

```bash
mkdir -p packages/server/src/{providers,session,tools}
mkdir -p packages/cli/src
```

**Step 7: 安装依赖**

```bash
bun install
```

**Step 8: Commit**

```bash
git add .```bash
git commit -m "chore: setup little-thing monorepo structure with server, cli, web packages"
```

---

### Task 2: 实现 Server 基础 HTTP 服务

**Files:**

- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

**Step 1: 创建 packages/server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 2: 编写基础 HTTP 服务**

```typescript
// packages/server/src/index.ts
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/chat", async (c) => {
  const body = await c.req.json();
  const { message } = body;

  if (!message) {
    return c.json({ error: "message is required" }, 400);
  }

  return c.json({
    response: `Echo: ${message}`,
  });
});

const PORT = process.env.PORT || 3000;

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Server running on http://localhost:${PORT}`);
```

**Step 3: 测试服务启动**

```bash
cd packages/server
bun run dev
```

Expected: 控制台显示 `Server running on http://localhost:3000`

**Step 4: 测试 health endpoint**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

**Step 5: 测试 chat endpoint**

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```

Expected: `{"response":"Echo: hello"}`

**Step 6: Commit**

```bash
git add packages/server/
git commit -m "feat(server): add basic HTTP server with /health and /chat endpoints"
```

---

### Task 3: 实现 Anthropic 格式 LLM Provider

**Files:**

- Create: `packages/server/src/providers/anthropic.ts`
- Create: `packages/server/src/providers/types.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: 创建类型定义**

```typescript
// packages/server/src/providers/types.ts
export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}
```

**Step 2: 实现 Anthropic Provider**

```typescript
// packages/server/src/providers/anthropic.ts
import type {
  LLMConfig,
  Message,
  ChatCompletionRequest,
  ChatCompletionResponse,
} from "./types.js";

export class AnthropicProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(messages: Message[]): Promise<ChatCompletionResponse> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      max_tokens: 4096,
    };

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      content: data.content?.[0]?.text || "",
      usage: data.usage,
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      stream: true,
      max_tokens: 4096,
    };

    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.delta?.text || "";
            if (delta) yield delta;
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}
```

**Step 3: 更新 server index.ts 集成 provider**

```typescript
// packages/server/src/index.ts
import { Hono } from "hono";
import { AnthropicProvider } from "./providers/anthropic.js";

const app = new Hono();

// 从环境变量读取配置
const llmConfig = {
  apiKey: process.env.LLM_API_KEY || "",
  baseUrl: process.env.LLM_BASE_URL || "https://api.moonshot.cn/v1",
  model: process.env.LLM_MODEL || "glm-4.7",
};

const provider = new AnthropicProvider(llmConfig);

app.get("/health", (c) => {
  return c.json({ status: "ok", model: llmConfig.model });
});

app.post("/chat", async (c) => {
  try {
    const body = await c.req.json();
    const { message } = body;

    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    if (!llmConfig.apiKey) {
      return c.json({ error: "LLM_API_KEY not configured" }, 500);
    }

    const response = await provider.chat([{ role: "user", content: message }]);

    return c.json({
      response: response.content,
      usage: response.usage,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

app.post("/chat/stream", async (c) => {
  try {
    const body = await c.req.json();
    const { message } = body;

    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    if (!llmConfig.apiKey) {
      return c.json({ error: "LLM_API_KEY not configured" }, 500);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of provider.streamChat([
            { role: "user", content: message },
          ])) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Stream error:", error);
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

const PORT = process.env.PORT || 3000;

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Server running on http://localhost:${PORT}`);
console.log(`Using model: ${llmConfig.model}`);
```

**Step 4: 测试（需要 API key）**

```bash
# 设置环境变量
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.moonshot.cn/v1"
export LLM_MODEL="kimi-k2.5"

# 启动服务
cd packages/server
bun run dev
```

测试请求：

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，请介绍一下自己"}'
```

**Step 5: Commit**

```bash
git add packages/server/
git commit -m "feat(server): add Anthropic provider with chat and stream support"
```

---

### Task 4: 实现 CLI 配置管理

**Files:**

- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/config.ts`
- Create: `packages/cli/src/api.ts`

**Step 1: 创建 packages/cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 2: 实现配置管理**

```typescript
// packages/cli/src/config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "littlething");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface CliConfig {
  serverUrl: string;
  apiKey?: string;
  model?: string;
}

const defaultConfig: CliConfig = {
  serverUrl: "http://localhost:3000",
  model: "kimi-k2.5",
};

export function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { ...defaultConfig };
  }

  try {
    const content = readFileSync(CONFIG_FILE, "utf-8");
    const saved = JSON.parse(content);
    return { ...defaultConfig, ...saved };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: Partial<CliConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = loadConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}
```

**Step 3: 实现 API 客户端**

```typescript
// packages/cli/src/api.ts
import type { CliConfig } from "./config.js";

export class ApiClient {
  private config: CliConfig;

  constructor(config: CliConfig) {
    this.config = config;
  }

  async chat(message: string): Promise<string> {
    const response = await fetch(`${this.config.serverUrl}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.response;
  }

  async *streamChat(message: string): AsyncGenerator<string> {
    const response = await fetch(`${this.config.serverUrl}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value);
    }
  }

  async health(): Promise<{ status: string; model: string }> {
    const response = await fetch(`${this.config.serverUrl}/health`);
    return response.json();
  }
}
```

**Step 4: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add config management and API client"
```

---

### Task 5: 实现 CLI 交互式对话

**Files:**

- Create: `packages/cli/src/chat.ts`
- Create: `packages/cli/src/index.ts`

**Step 1: 实现交互式对话模块**

```typescript
// packages/cli/src/chat.ts
import * as readline from "readline";
import { ApiClient } from "./api.js";
import type { CliConfig } from "./config.js";

export async function startInteractiveChat(config: CliConfig) {
  const client = new ApiClient(config);

  // 检查 server 健康状态
  try {
    const health = await client.health();
    console.log(`✓ Connected to server (${health.model})`);
  } catch {
    console.error("✗ Cannot connect to server at", config.serverUrl);
    console.error("  Make sure the server is running: bun run dev:server");
    process.exit(1);
  }

  console.log("\n🤖 little thing Chat\n");
  console.log("Type your message and press Enter.");
  console.log("Commands: /quit, /exit, /clear\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      if (trimmed === "/quit" || trimmed === "/exit") {
        console.log("\nGoodbye! 👋");
        rl.close();
        return;
      }

      if (trimmed === "/clear") {
        console.clear();
        askQuestion();
        return;
      }

      try {
        process.stdout.write("AI: ");

        // 使用流式输出
        for await (const chunk of client.streamChat(trimmed)) {
          process.stdout.write(chunk);
        }

        console.log("\n");
      } catch (error) {
        console.error(
          "\n✗ Error:",
          error instanceof Error ? error.message : "Unknown error",
        );
      }

      askQuestion();
    });
  };

  askQuestion();
}
```

**Step 2: 实现 CLI 入口**

```typescript
#!/usr/bin/env bun
// packages/cli/src/index.ts

import { loadConfig, saveConfig, getConfigPath } from "./config.js";
import { startInteractiveChat } from "./chat.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "config":
      handleConfig(args.slice(1));
      break;

    case "chat":
    case undefined:
      await startInteractiveChat(loadConfig());
      break;

    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

function handleConfig(args: string[]) {
  const subCommand = args[0];

  if (subCommand === "set" && args.length >= 3) {
    const key = args[1] as "serverUrl" | "apiKey" | "model";
    const value = args[2];
    saveConfig({ [key]: value });
    console.log(`Set ${key} = ${value}`);
  } else if (subCommand === "get") {
    const config = loadConfig();
    console.log("Config file:", getConfigPath());
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log("Usage:");
    console.log("  agent config get           - Show current config");
    console.log("  agent config set <key> <value>  - Set config value");
    console.log("");
    console.log("Keys: serverUrl, apiKey, model");
  }
}

function showHelp() {
  console.log("little thing CLI\n");
  console.log("Commands:");
  console.log("  lt              - Start interactive chat");
  console.log("  lt chat         - Start interactive chat");
  console.log("  lt config get   - Show config");
  console.log("  lt config set   - Set config value");
  console.log("  lt help         - Show this help");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
```

**Step 3: 更新 package.json 添加 bin 入口**

```json
{
  "name": "@littlething/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "lt": "./src/index.ts"
  },
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "build": "tsc"
  }
}
```

**Step 4: 安装依赖并测试**

```bash
# 在根目录
bun install

# 先启动 server（终端 1）
bun run dev:server

# 再启动 cli（终端 2）
bun run dev:cli
```

Expected: 进入交互式对话模式

**Step 5: 测试完整流程**

```
🤖 Agent Chat

Type your message and press Enter.
Commands: /quit, /exit, /clear

You: 你好
AI: 你好！很高兴见到你。有什么我可以帮助你的吗？

You: /quit
Goodbye! 👋
```

**Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add interactive chat with streaming output"
```

---

### Task 6: 添加 README 文档

**Files:**

- Create: `README.md`

**Step 1: 创建 README**

````markdown
# little thing

通用 LLM Agent 平台，支持 CLI 和 Web 客户端。

## 快速开始

### 1. 配置环境变量

```bash
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.moonshot.cn/v1"  # 或 GLM: https://open.bigmodel.cn/api/paas/v4
export LLM_MODEL="kimi-k2.5"
```
````

### 2. 安装依赖

```bash
bun install
```

### 3. 启动 Server

```bash
bun run dev:server
```

### 4. 启动 CLI 客户端

```bash
bun run dev:cli
```

## 项目结构

```
packages/
├── server/    # 后端服务（LLM、工具、会话）
├── cli/       # 命令行客户端
└── web/       # Web 客户端（预留）
```

## CLI 命令

- `bun run dev:cli` - 启动交互式对话
- `lt config get` - 查看配置
- `lt config set serverUrl <url>` - 设置服务器地址

````

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add quick start guide"
````

---

## 验证清单

Phase 1 完成后，应该可以：

- [ ] `bun install` 成功安装所有依赖
- [ ] `bun run dev:server` 启动 HTTP 服务
- [ ] `curl http://localhost:3000/health` 返回健康状态
- [ ] `bun run dev:cli` 启动交互式对话
- [ ] 输入消息，AI 流式回复
- [ ] `/quit` 命令正常退出

## 下一步（Phase 2）

- 会话持久化存储
- 会话列表/切换命令
- 消息历史管理

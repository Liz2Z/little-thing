# Phase 2: 会话管理实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现会话持久化存储，支持多会话管理和消息历史记录。

**Architecture:** 在 CLI 层实现 SessionStore 类管理文件存储（JSON/JSONL），按 XDG 规范存放在 `~/.local/share/littlething/`。新增 CLI 命令 `/new`, `/list`, `/switch` 等管理会话。

**Tech Stack:** Bun + TypeScript, 原生 fs API

---

### Task 1: 创建会话存储类型定义

**Files:**
- Create: `packages/cli/src/types.ts`

**Step 1: 创建类型定义文件**

```typescript
// packages/cli/src/types.ts

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  systemPrompt?: string;
}

export interface SessionIndex {
  activeSessionId: string | null;
  sessions: Record<string, SessionMeta>;
}

export interface Session {
  meta: SessionMeta;
  messages: Message[];
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/types.ts
git commit -m "feat(cli): add session types"
```

---

### Task 2: 实现 SessionStore 类

**Files:**
- Create: `packages/cli/src/session-store.ts`

**Step 1: 实现 SessionStore**

```typescript
// packages/cli/src/session-store.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Message, SessionMeta, SessionIndex, Session } from './types.js';

const DATA_DIR = join(homedir(), '.local', 'share', 'littlething', 'sessions');
const INDEX_FILE = join(DATA_DIR, 'index.json');

function generateId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8);
  return `${date}-${random}`;
}

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getSessionFilePath(sessionId: string): string {
  return join(DATA_DIR, `${sessionId}.jsonl`);
}

export class SessionStore {
  private index: SessionIndex;

  constructor() {
    ensureDataDir();
    this.index = this.loadIndex();
  }

  private loadIndex(): SessionIndex {
    if (!existsSync(INDEX_FILE)) {
      return { activeSessionId: null, sessions: {} };
    }
    try {
      const content = readFileSync(INDEX_FILE, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { activeSessionId: null, sessions: {} };
    }
  }

  private saveIndex(): void {
    writeFileSync(INDEX_FILE, JSON.stringify(this.index, null, 2));
  }

  private loadMessages(sessionId: string): Message[] {
    const filePath = getSessionFilePath(sessionId);
    if (!existsSync(filePath)) {
      return [];
    }
    try {
      const content = readFileSync(filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  private appendMessage(sessionId: string, message: Message): void {
    const filePath = getSessionFilePath(sessionId);
    const line = JSON.stringify(message) + '\n';
    appendFileSync(filePath, line);
  }

  getActiveSessionId(): string | null {
    return this.index.activeSessionId;
  }

  getSession(sessionId: string): Session | null {
    const meta = this.index.sessions[sessionId];
    if (!meta) return null;
    const messages = this.loadMessages(sessionId);
    return { meta, messages };
  }

  getActiveSession(): Session | null {
    const id = this.getActiveSessionId();
    return id ? this.getSession(id) : null;
  }

  listSessions(): SessionMeta[] {
    return Object.values(this.index.sessions).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  createSession(name?: string): SessionMeta {
    const id = generateId();
    const now = new Date().toISOString();
    const sessionName = name || `会话-${Object.keys(this.index.sessions).length + 1}`;

    const meta: SessionMeta = {
      id,
      name: sessionName,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    };

    this.index.sessions[id] = meta;
    this.index.activeSessionId = id;
    this.saveIndex();

    return meta;
  }

  switchSession(sessionId: string): boolean {
    if (!this.index.sessions[sessionId]) {
      return false;
    }
    this.index.activeSessionId = sessionId;
    this.saveIndex();
    return true;
  }

  addMessage(sessionId: string, message: Message): boolean {
    const meta = this.index.sessions[sessionId];
    if (!meta) return false;

    this.appendMessage(sessionId, message);
    meta.messageCount++;
    meta.updatedAt = new Date().toISOString();
    this.saveIndex();
    return true;
  }

  deleteSession(sessionId: string): boolean {
    if (!this.index.sessions[sessionId]) {
      return false;
    }

    delete this.index.sessions[sessionId];
    if (this.index.activeSessionId === sessionId) {
      this.index.activeSessionId = null;
    }
    this.saveIndex();

    const filePath = getSessionFilePath(sessionId);
    try {
      import('fs').then(fs => fs.unlinkSync(filePath));
    } catch {
      // Ignore delete errors
    }

    return true;
  }

  renameSession(sessionId: string, newName: string): boolean {
    const meta = this.index.sessions[sessionId];
    if (!meta) return false;

    meta.name = newName;
    meta.updatedAt = new Date().toISOString();
    this.saveIndex();
    return true;
  }

  getOrCreateSession(): Session {
    let session = this.getActiveSession();
    if (!session) {
      const meta = this.createSession();
      session = { meta, messages: [] };
    }
    return session;
  }
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/session-store.ts
git commit -m "feat(cli): add SessionStore for session persistence"
```

---

### Task 3: 更新配置管理支持数据目录

**Files:**
- Modify: `packages/cli/src/config.ts`

**Step 1: 添加数据目录配置**

```typescript
// packages/cli/src/config.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'littlething');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DATA_DIR = join(homedir(), '.local', 'share', 'littlething');

export interface CliConfig {
  serverUrl: string;
  apiKey?: string;
  model?: string;
  dataDir: string;
}

const defaultConfig: CliConfig = {
  serverUrl: 'http://localhost:3000',
  model: 'kimi-k2.5',
  dataDir: DATA_DIR,
};

export function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { ...defaultConfig };
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
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

export function getDataDir(): string {
  return DATA_DIR;
}

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/config.ts
git commit -m "feat(cli): update config with data directory support"
```

---

### Task 4: 更新 API 客户端支持历史消息

**Files:**
- Modify: `packages/cli/src/api.ts`

**Step 1: 更新 API 客户端**

```typescript
// packages/cli/src/api.ts
import type { CliConfig } from './config.js';
import type { Message } from './types.js';

export class ApiClient {
  private config: CliConfig;

  constructor(config: CliConfig) {
    this.config = config;
  }

  async chat(messages: Message[]): Promise<string> {
    // 发送到 /chat 端点，包含历史消息
    const response = await fetch(`${this.config.serverUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.response;
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    const response = await fetch(`${this.config.serverUrl}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
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

**Step 2: Commit**

```bash
git add packages/cli/src/api.ts
git commit -m "feat(cli): update API client to support message history"
```

---

### Task 5: 更新 Server 支持消息历史

**Files:**
- Modify: `packages/server/src/index.ts`
- Modify: `packages/server/src/providers/types.ts`

**Step 1: 更新 Provider 类型**

```typescript
// packages/server/src/providers/types.ts
export interface Message {
  role: 'system' | 'user' | 'assistant';
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

**Step 2: 更新 Server 端点**

```typescript
// packages/server/src/index.ts
import { Hono } from 'hono';
import { AnthropicProvider } from './providers/anthropic.js';
import type { Message } from './providers/types.js';

const app = new Hono();

const llmConfig = {
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: process.env.LLM_BASE_URL || 'https://api.moonshot.cn/v1',
  model: process.env.LLM_MODEL || 'kimi-k2.5',
};

const provider = new AnthropicProvider(llmConfig);

app.get('/health', (c) => {
  return c.json({ status: 'ok', model: llmConfig.model });
});

// 接受 messages 数组而非单个 message
app.post('/chat', async (c) => {
  try {
    const body = await c.req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    if (!llmConfig.apiKey) {
      return c.json({ error: 'LLM_API_KEY not configured' }, 500);
    }

    const response = await provider.chat(messages as Message[]);

    return c.json({
      response: response.content,
      usage: response.usage,
    });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

app.post('/chat/stream', async (c) => {
  try {
    const body = await c.req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400);
    }

    if (!llmConfig.apiKey) {
      return c.json({ error: 'LLM_API_KEY not configured' }, 500);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of provider.streamChat(messages as Message[])) {
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
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
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

**Step 3: Commit**

```bash
git add packages/server/src/
git commit -m "feat(server): update endpoints to accept message history"
```

---

### Task 6: 更新交互式对话支持会话管理

**Files:**
- Modify: `packages/cli/src/chat.ts`

**Step 1: 重写 chat.ts**

```typescript
// packages/cli/src/chat.ts
import * as readline from 'readline';
import { ApiClient } from './api.js';
import { SessionStore } from './session-store.js';
import type { CliConfig } from './config.js';
import type { Message } from './types.js';

export async function startInteractiveChat(config: CliConfig) {
  const client = new ApiClient(config);
  const store = new SessionStore();

  // 检查 server 健康状态
  try {
    const health = await client.health();
    console.log(`✓ Connected to server (${health.model})`);
  } catch {
    console.error('✗ Cannot connect to server at', config.serverUrl);
    console.error('  Make sure the server is running: bun run dev:server');
    process.exit(1);
  }

  // 获取或创建会话
  const session = store.getOrCreateSession();
  console.log(`\n🤖 little thing - ${session.meta.name}\n`);
  console.log('Type your message and press Enter.');
  console.log('Commands: /new, /list, /switch, /delete, /rename, /clear, /quit\n');

  // 显示历史消息
  if (session.messages.length > 0) {
    console.log('--- 历史消息 ---');
    for (const msg of session.messages) {
      if (msg.role === 'user') {
        console.log(`You: ${msg.content}`);
      } else if (msg.role === 'assistant') {
        console.log(`AI: ${msg.content}\n`);
      }
    }
    console.log('--- 新消息 ---\n');
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        askQuestion();
        return;
      }

      // 处理命令
      if (trimmed.startsWith('/')) {
        const handled = await handleCommand(trimmed, store, rl);
        if (handled === 'quit') {
          console.log('\nGoodbye! 👋');
          rl.close();
          return;
        }
        askQuestion();
        return;
      }

      // 发送消息
      try {
        const sessionId = store.getActiveSessionId();
        if (!sessionId) {
          console.log('No active session');
          askQuestion();
          return;
        }

        // 保存用户消息
        const userMessage: Message = {
          role: 'user',
          content: trimmed,
          timestamp: new Date().toISOString(),
        };
        store.addMessage(sessionId, userMessage);

        // 获取所有历史消息
        const currentSession = store.getSession(sessionId);
        if (!currentSession) {
          console.log('Session not found');
          askQuestion();
          return;
        }

        process.stdout.write('AI: ');

        // 流式输出并收集完整响应
        let fullResponse = '';
        for await (const chunk of client.streamChat(currentSession.messages)) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }

        console.log('\n');

        // 保存 AI 回复
        const assistantMessage: Message = {
          role: 'assistant',
          content: fullResponse,
          timestamp: new Date().toISOString(),
        };
        store.addMessage(sessionId, assistantMessage);
      } catch (error) {
        console.error('\n✗ Error:', error instanceof Error ? error.message : 'Unknown error');
      }

      askQuestion();
    });
  };

  askQuestion();
}

async function handleCommand(
  input: string,
  store: SessionStore,
  rl: readline.Interface
): Promise<'quit' | 'continue'> {
  const parts = input.split(' ');
  const command = parts[0];
  const args = parts.slice(1);

  switch (command) {
    case '/quit':
    case '/exit':
      return 'quit';

    case '/clear':
      console.clear();
      return 'continue';

    case '/new': {
      const name = args.join(' ') || undefined;
      const session = store.createSession(name);
      console.log(`✓ Created new session: ${session.name} (${session.id})`);
      return 'continue';
    }

    case '/list': {
      const sessions = store.listSessions();
      const activeId = store.getActiveSessionId();

      if (sessions.length === 0) {
        console.log('No sessions yet. Use /new to create one.');
        return 'continue';
      }

      console.log('\nSessions:');
      for (const s of sessions) {
        const marker = s.id === activeId ? '→ ' : '  ';
        console.log(`${marker}${s.name} (${s.id}) - ${s.messageCount} messages`);
      }
      console.log('');
      return 'continue';
    }

    case '/switch': {
      const sessionId = args[0];
      if (!sessionId) {
        console.log('Usage: /switch <session-id>');
        return 'continue';
      }

      if (store.switchSession(sessionId)) {
        const session = store.getSession(sessionId);
        console.log(`✓ Switched to: ${session?.meta.name}`);
        // 显示历史消息
        if (session && session.messages.length > 0) {
          console.log('\n--- 历史消息 ---');
          for (const msg of session.messages) {
            if (msg.role === 'user') {
              console.log(`You: ${msg.content}`);
            } else if (msg.role === 'assistant') {
              console.log(`AI: ${msg.content}\n`);
            }
          }
          console.log('---\n');
        }
      } else {
        console.log('✗ Session not found');
      }
      return 'continue';
    }

    case '/delete': {
      const deleteId = args[0];
      if (!deleteId) {
        console.log('Usage: /delete <session-id>');
        return 'continue';
      }

      // 简单确认
      if (store.deleteSession(deleteId)) {
        console.log('✓ Session deleted');
      } else {
        console.log('✗ Session not found');
      }
      return 'continue';
    }

    case '/rename': {
      const newName = args.join(' ');
      if (!newName) {
        console.log('Usage: /rename <new-name>');
        return 'continue';
      }

      const activeId = store.getActiveSessionId();
      if (!activeId) {
        console.log('No active session');
        return 'continue';
      }

      if (store.renameSession(activeId, newName)) {
        console.log(`✓ Renamed to: ${newName}`);
      }
      return 'continue';
    }

    case '/help':
      console.log('\nCommands:');
      console.log('  /new [name]    - Create new session');
      console.log('  /list          - List all sessions');
      console.log('  /switch <id>   - Switch to session');
      console.log('  /delete <id>   - Delete session');
      console.log('  /rename <name> - Rename current session');
      console.log('  /clear         - Clear screen');
      console.log('  /quit, /exit   - Exit');
      console.log('');
      return 'continue';

    default:
      console.log(`Unknown command: ${command}. Type /help for available commands.`);
      return 'continue';
  }
}
```

**Step 2: Commit**

```bash
git add packages/cli/src/chat.ts
git commit -m "feat(cli): update chat with session management commands"
```

---

### Task 7: 更新 CLI 入口支持命令行操作

**Files:**
- Modify: `packages/cli/src/index.ts`

**Step 1: 添加会话命令行操作**

```typescript
#!/usr/bin/env bun

import { loadConfig, saveConfig, getConfigPath } from './config.js';
import { startInteractiveChat } from './chat.js';
import { SessionStore } from './session-store.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'config':
      handleConfig(args.slice(1));
      break;

    case 'sessions':
      handleSessions(args.slice(1));
      break;

    case 'chat':
    case undefined:
      await startInteractiveChat(loadConfig());
      break;

    case 'help':
    case '--help':
    case '-h':
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

  if (subCommand === 'set' && args.length >= 3) {
    const key = args[1] as 'serverUrl' | 'apiKey' | 'model' | 'dataDir';
    const value = args[2];
    saveConfig({ [key]: value });
    console.log(`Set ${key} = ${value}`);
  } else if (subCommand === 'get') {
    const config = loadConfig();
    console.log('Config file:', getConfigPath());
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log('Usage:');
    console.log('  lt config get                - Show current config');
    console.log('  lt config set <key> <value>  - Set config value');
    console.log('');
    console.log('Keys: serverUrl, apiKey, model, dataDir');
  }
}

function handleSessions(args: string[]) {
  const store = new SessionStore();
  const subCommand = args[0];

  switch (subCommand) {
    case 'list':
    case 'ls': {
      const sessions = store.listSessions();
      const activeId = store.getActiveSessionId();

      if (sessions.length === 0) {
        console.log('No sessions yet.');
        return;
      }

      console.log('Sessions:');
      for (const s of sessions) {
        const marker = s.id === activeId ? '→ ' : '  ';
        console.log(`${marker}${s.name} (${s.id}) - ${s.messageCount} messages`);
      }
      break;
    }

    case 'new': {
      const name = args.slice(1).join(' ') || undefined;
      const session = store.createSession(name);
      console.log(`Created: ${session.name} (${session.id})`);
      break;
    }

    case 'switch': {
      const id = args[1];
      if (!id) {
        console.log('Usage: lt sessions switch <session-id>');
        return;
      }
      if (store.switchSession(id)) {
        const session = store.getSession(id);
        console.log(`Switched to: ${session?.meta.name}`);
      } else {
        console.log('Session not found');
      }
      break;
    }

    case 'delete': {
      const id = args[1];
      if (!id) {
        console.log('Usage: lt sessions delete <session-id>');
        return;
      }
      if (store.deleteSession(id)) {
        console.log('Session deleted');
      } else {
        console.log('Session not found');
      }
      break;
    }

    default:
      console.log('Usage:');
      console.log('  lt sessions list           - List all sessions');
      console.log('  lt sessions new [name]     - Create new session');
      console.log('  lt sessions switch <id>    - Switch to session');
      console.log('  lt sessions delete <id>    - Delete session');
  }
}

function showHelp() {
  console.log('little thing CLI\n');
  console.log('Commands:');
  console.log('  lt                    - Start interactive chat');
  console.log('  lt chat               - Start interactive chat');
  console.log('  lt config get         - Show config');
  console.log('  lt config set         - Set config value');
  console.log('  lt sessions list      - List sessions');
  console.log('  lt sessions new       - Create session');
  console.log('  lt sessions switch    - Switch session');
  console.log('  lt help               - Show this help');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
```

**Step 2: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add session management CLI commands"
```

---

### Task 8: 更新 README 文档

**Files:**
- Modify: `README.md`

**Step 1: 添加会话管理说明**

```markdown
# little thing

通用 LLM Agent 平台，支持 CLI 和 Web 客户端。

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

### 3. 启动 Server

```bash
bun run dev:server
```

### 4. 启动 CLI 客户端

```bash
bun run dev:cli
```

## 会话管理

CLI 支持多会话管理，数据存储在 `~/.local/share/littlething/`。

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

## 项目结构

```
packages/
├── server/    # 后端服务（LLM、工具、会话）
├── cli/       # 命令行客户端
└── web/       # Web 客户端（预留）
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
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add session management documentation"
```

---

## 验证清单

Phase 2 完成后验证：

- [ ] `bun run dev:cli` 启动后自动创建或恢复会话
- [ ] 发送消息后，消息自动保存到 `~/.local/share/littlething/sessions/{id}.jsonl`
- [ ] `/new` 创建新会话，当前会话切换到新会话
- [ ] `/list` 显示所有会话列表
- [ ] `/switch <id>` 切换会话并显示历史消息
- [ ] `/rename <name>` 重命名当前会话
- [ ] `/delete <id>` 删除会话
- [ ] 重启 CLI 后自动恢复上次活跃会话
- [ ] `lt sessions list` 命令行列出会话
- [ ] `lt sessions new` 命令行创建会话

## 下一步（Phase 3）

- 工具系统集成
- 支持函数调用
- 内置基础工具（文件读写、命令执行等）

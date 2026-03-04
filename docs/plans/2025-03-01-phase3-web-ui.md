# Web UI 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 little thing 构建现代化的 Web 用户界面，提供直观的聊天体验和会话管理功能

**Architecture:** 多页应用架构，React + Vite + Tailwind CSS + Zustand，通过 HTTP API 与 Server 通信

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand, React Router v6, 原生 fetch

---

## 前置条件

确保 Server 端已运行，API 端点可用：
- `GET /sessions` - 列出所有会话
- `POST /sessions` - 创建新会话
- `GET /sessions/:id` - 获取会话详情和消息
- `DELETE /sessions/:id` - 删除会话
- `PUT /sessions/:id` - 重命名会话
- `POST /sessions/:id/chat/stream` - 流式聊天

---

## Task 1: 创建 Web Package 基础结构

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/tsconfig.node.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/index.html`
- Create: `packages/web/src/main.tsx`
- Create: `packages/web/src/App.tsx`
- Create: `packages/web/src/vite-env.d.ts`

**Step 1: 创建 package.json**

```bash
mkdir -p packages/web
```

创建 `packages/web/package.json`:
```json
{
  "name": "@littlething/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.0"
  }
}
```

**Step 2: 创建 tsconfig.json**

创建 `packages/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 3: 创建 tsconfig.node.json**

创建 `packages/web/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: 创建 vite.config.ts**

创建 `packages/web/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/sessions': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: 创建 index.html**

创建 `packages/web/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Chat</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: 创建 main.tsx**

创建 `packages/web/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 7: 创建 App.tsx**

创建 `packages/web/src/App.tsx`:
```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold p-4">Agent Chat</h1>
    </div>
  );
}
```

**Step 8: 创建基础 CSS**

创建 `packages/web/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 9: 创建 Tailwind 配置**

创建 `packages/web/tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

创建 `packages/web/postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 10: 安装依赖并测试**

```bash
bun install
bun run --filter @littlething/web dev
```

Expected: Vite dev server 启动在 http://localhost:5173，显示 "Agent Chat" 标题

**Step 11: 提交**

```bash
git add packages/web/
git commit -m "feat(web): add Vite + React + Tailwind CSS base setup"
```

---

## Task 2: 配置路由和页面结构

**Files:**
- Modify: `packages/web/src/App.tsx`
- Create: `packages/web/src/pages/ChatPage.tsx`
- Create: `packages/web/src/pages/SettingsPage.tsx`
- Create: `packages/web/src/components/Layout.tsx`

**Step 1: 安装 React Router**

```bash
bun add react-router-dom --filter @littlething/web
```

**Step 2: 创建 Layout 组件**

创建 `packages/web/src/components/Layout.tsx`:
```typescript
import { Outlet, Link } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Agent Chat</h1>
          <div className="flex gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              聊天
            </Link>
            <Link to="/settings" className="text-gray-600 hover:text-gray-900">
              设置
            </Link>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
```

**Step 3: 创建 ChatPage**

创建 `packages/web/src/pages/ChatPage.tsx`:
```typescript
export function ChatPage() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <h2 className="text-lg font-semibold mb-4">聊天</h2>
      <p className="text-gray-600">聊天页面开发中...</p>
    </div>
  );
}
```

**Step 4: 创建 SettingsPage**

创建 `packages/web/src/pages/SettingsPage.tsx`:
```typescript
export function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <h2 className="text-lg font-semibold mb-4">设置</h2>
      <p className="text-gray-600">设置页面开发中...</p>
    </div>
  );
}
```

**Step 5: 更新 App.tsx 添加路由**

修改 `packages/web/src/App.tsx`:
```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Step 6: 测试路由**

```bash
# 确保开发服务器在运行
bun run --filter @littlething/web dev
```

Expected:
- 访问 http://localhost:5173 显示 "聊天" 页面
- 访问 http://localhost:5173/settings 显示 "设置" 页面
- 导航栏可以切换页面

**Step 7: 提交**

```bash
git add packages/web/src/
git commit -m "feat(web): add React Router and page structure"
```

---

## Task 3: 创建 API 类型定义和 Client

**Files:**
- Create: `packages/web/src/api/types.ts`
- Create: `packages/web/src/api/client.ts`

**Step 1: 创建类型定义**

创建 `packages/web/src/api/types.ts`:
```typescript
// API 响应类型
export interface Session {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface SessionDetail {
  meta: Session;
  messages: Message[];
}

// API 请求/响应类型
export interface SessionsListResponse {
  sessions: Session[];
}

export interface SessionResponse {
  session: SessionDetail;
}

export interface CreateSessionRequest {
  name?: string;
}

export interface CreateSessionResponse {
  session: Session;
}

export interface RenameSessionRequest {
  name: string;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ErrorResponse {
  error: string;
}
```

**Step 2: 创建 API Client**

创建 `packages/web/src/api/client.ts`:
```typescript
import type {
  Session,
  SessionDetail,
  SessionsListResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  RenameSessionRequest,
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:3000';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // 会话相关
  async getSessions(): Promise<Session[]> {
    const res = await this.request<SessionsListResponse>('/sessions');
    return res.sessions;
  }

  async createSession(name?: string): Promise<Session> {
    const body: CreateSessionRequest = name ? { name } : {};
    const res = await this.request<CreateSessionResponse>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.session;
  }

  async getSession(id: string): Promise<SessionDetail> {
    const res = await this.request<{ session: SessionDetail }>(`/sessions/${id}`);
    return res.session;
  }

  async deleteSession(id: string): Promise<void> {
    await this.request(`/sessions/${id}`, { method: 'DELETE' });
  }

  async renameSession(id: string, name: string): Promise<void> {
    const body: RenameSessionRequest = { name };
    await this.request(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // 流式聊天
  async *streamChat(sessionId: string, message: string): AsyncGenerator<string> {
    const url = `${this.baseUrl}/sessions/${sessionId}/chat/stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Chat failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        yield chunk;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

**Step 3: 测试 API Client**

```bash
# 确保 server 在运行
bun run dev:server
```

创建临时测试文件 `packages/web/src/test-api.ts`:
```typescript
import { ApiClient } from './api/client';

async function test() {
  const client = new ApiClient();

  // 测试获取会话列表
  const sessions = await client.getSessions();
  console.log('Sessions:', sessions);

  // 测试创建会话
  const newSession = await client.createSession('测试会话');
  console.log('Created:', newSession);

  // 测试流式聊天
  for await (const chunk of client.streamChat(newSession.id, '你好')) {
    process.stdout.write(chunk);
  }
}

test().catch(console.error);
```

**Step 4: 提交**

```bash
git add packages/web/src/api/
git commit -m "feat(web): add API types and client"
```

---

## Task 4: 创建 Zustand Store

**Files:**
- Create: `packages/web/src/store/configStore.ts`
- Create: `packages/web/src/store/sessionStore.ts`

**Step 1: 创建 Config Store**

创建 `packages/web/src/store/configStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConfigState {
  apiUrl: string;
  apiKey: string;
  model: string;
  setConfig: (config: Partial<ConfigState>) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      apiUrl: 'http://localhost:3000',
      apiKey: '',
      model: 'glm-4',
      setConfig: (config) => set((state) => ({ ...state, ...config })),
    }),
    {
      name: 'littlething-config',
    }
  )
);
```

**Step 2: 创建 Session Store**

创建 `packages/web/src/store/sessionStore.ts`:
```typescript
import { create } from 'zustand';
import type { Session, Message } from '../api/types';
import { ApiClient } from '../api/client';
import { useConfigStore } from './configStore';

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionMessages: Message[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  fetchSessionMessages: (id: string) => Promise<void>;
  sendMessage: (content: string) => AsyncGenerator<string>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSessionMessages: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const sessions = await client.getSessions();
      set({ sessions, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoading: false,
      });
    }
  },

  createSession: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const session = await client.createSession(name);
      set((state) => ({
        sessions: [...state.sessions, session],
        isLoading: false,
      }));
      return session;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create session',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      await client.deleteSession(id);
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete session',
        isLoading: false,
      });
    }
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
    if (id) {
      get().fetchSessionMessages(id);
    } else {
      set({ activeSessionMessages: [] });
    }
  },

  fetchSessionMessages: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const session = await client.getSession(id);
      set({
        activeSessionMessages: session.messages,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
        isLoading: false,
      });
    }
  },

  sendMessage: async function* (content: string) {
    const { activeSessionId } = get();
    if (!activeSessionId) {
      throw new Error('No active session');
    }

    // 添加用户消息
    const userMessage: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      activeSessionMessages: [...state.activeSessionMessages, userMessage],
    }));

    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);

      let fullResponse = '';
      for await (const chunk of client.streamChat(activeSessionId, content)) {
        fullResponse += chunk;
        // 实时更新最后一条消息
        set((state) => {
          const messages = [...state.activeSessionMessages];
          if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
            messages[messages.length - 1] = {
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
            };
          } else {
            messages.push({
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
            });
          }
          return { activeSessionMessages: messages };
        });
        yield chunk;
      }

      // 刷新会话列表以更新 messageCount
      get().fetchSessions();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
```

**Step 3: 安装 zustand persist middleware**

```bash
cd packages/web && bun add zustand
```

注意：zustand 的 persist middleware 已包含在主包中。

**Step 4: 提交**

```bash
git add packages/web/src/store/
git commit -m "feat(web): add Zustand stores for config and sessions"
```

---

## Task 5: 创建消息组件

**Files:**
- Create: `packages/web/src/components/MessageBubble.tsx`
- Create: `packages/web/src/components/MessageList.tsx`
- Create: `packages/web/src/components/Loading.tsx`

**Step 1: 创建 MessageBubble 组件**

创建 `packages/web/src/components/MessageBubble.tsx`:
```typescript
import type { Message } from '../api/types';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-sm'
            : 'bg-white text-gray-800 border rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <span
          className={`text-xs mt-1 block ${
            isUser ? 'text-blue-100' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: 创建 MessageList 组件**

创建 `packages/web/src/components/MessageList.tsx`:
```typescript
import { useEffect, useRef } from 'react';
import type { Message } from '../api/types';
import { MessageBubble } from './MessageBubble';

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">开始新对话...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.map((message, index) => (
        <MessageBubble key={`${message.timestamp}-${index}`} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

**Step 3: 创建 Loading 组件**

创建 `packages/web/src/components/Loading.tsx`:
```typescript
export function Loading() {
  return (
    <div className="flex justify-center items-center p-4">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
      </div>
    </div>
  );
}
```

**Step 4: 提交**

```bash
git add packages/web/src/components/
git commit -m "feat(web): add message display components"
```

---

## Task 6: 创建会话列表组件

**Files:**
- Create: `packages/web/src/components/SessionItem.tsx`
- Create: `packages/web/src/components/SessionList.tsx`

**Step 1: 创建 SessionItem 组件**

创建 `packages/web/src/components/SessionItem.tsx`:
```typescript
import type { Session } from '../api/types';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function SessionItem({ session, isActive, onClick, onDelete }: SessionItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除会话 "${session.name}" 吗？`)) {
      onDelete(session.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors border-b ${
        isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{session.name}</h3>
          <p className="text-xs text-gray-500 mt-1">
            {session.messageCount} 条消息 · {new Date(session.updatedAt).toLocaleDateString('zh-CN')}
          </p>
        </div>
        <button
          onClick={handleDelete}
          className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
          title="删除会话"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
```

**Step 2: 创建 SessionList 组件**

创建 `packages/web/src/components/SessionList.tsx`:
```typescript
import { useSessionStore } from '../store/sessionStore';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  onCreateSession: () => void;
}

export function SessionList({ onCreateSession }: SessionListProps) {
  const { sessions, activeSessionId, setActiveSession, deleteSession, isLoading } = useSessionStore();

  return (
    <div className="w-64 bg-white border-r flex flex-col">
      <div className="p-4 border-b">
        <button
          onClick={onCreateSession}
          className="w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium"
        >
          + 新建会话
        </button>
      </div>

      {isLoading && sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              暂无会话
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => setActiveSession(session.id)}
                onDelete={deleteSession}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: 提交**

```bash
git add packages/web/src/components/
git commit -m "feat(web): add session list components"
```

---

## Task 7: 创建输入框组件

**Files:**
- Create: `packages/web/src/components/ChatInput.tsx`

**Step 1: 创建 ChatInput 组件**

创建 `packages/web/src/components/ChatInput.tsx`:
```typescript
import { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-white border-t">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          disabled={disabled}
          rows={1}
          className="flex-1 px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          style={{ minHeight: '42px', maxHeight: '200px' }}
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          发送
        </button>
      </div>
    </form>
  );
}
```

**Step 2: 提交**

```bash
git add packages/web/src/components/ChatInput.tsx
git commit -m "feat(web): add chat input component"
```

---

## Task 8: 实现 ChatPage 完整功能

**Files:**
- Modify: `packages/web/src/pages/ChatPage.tsx`

**Step 1: 实现 ChatPage**

修改 `packages/web/src/pages/ChatPage.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { SessionList } from '../components/SessionList';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { Loading } from '../components/Loading';

export function ChatPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const {
    sessions,
    activeSessionId,
    activeSessionMessages,
    isLoading,
    error,
    fetchSessions,
    createSession,
    setActiveSession,
    sendMessage,
    clearError,
  } = useSessionStore();

  // 初始化加载会话列表
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 自动创建第一个会话
  useEffect(() => {
    if (!isLoading && sessions.length === 0) {
      handleCreateSession();
    }
  }, [isLoading, sessions.length]);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const session = await createSession(`会话 ${new Date().toLocaleString('zh-CN')}`);
      setActiveSession(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!activeSessionId || isStreaming) return;

    setIsStreaming(true);
    clearError();

    try {
      for await (const _chunk of sendMessage(message)) {
        // 流式更新自动由 store 处理
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)]">
      <SessionList onCreateSession={handleCreateSession} />

      <div className="flex-1 flex flex-col">
        {activeSessionId ? (
          <>
            <div className="bg-white border-b px-6 py-3">
              <h2 className="font-semibold text-gray-900">
                {sessions.find((s) => s.id === activeSessionId)?.name || '聊天'}
              </h2>
            </div>

            <MessageList messages={activeSessionMessages} />

            {isStreaming && <Loading />}

            <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">选择或创建一个会话开始聊天</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 测试完整聊天流程**

```bash
# 确保 server 和 web 都在运行
bun run dev:server
bun run --filter @littlething/web dev
```

测试步骤:
1. 打开 http://localhost:5173
2. 自动创建会话
3. 输入消息并发送
4. 查看流式输出
5. 切换/创建/删除会话

Expected: 完整的聊天功能可用

**Step 3: 提交**

```bash
git add packages/web/src/pages/ChatPage.tsx
git commit -m "feat(web): implement complete ChatPage functionality"
```

---

## Task 9: 实现设置页面

**Files:**
- Modify: `packages/web/src/pages/SettingsPage.tsx`

**Step 1: 实现 SettingsPage**

修改 `packages/web/src/pages/SettingsPage.tsx`:
```typescript
import { useConfigStore } from '../store/configStore';

export function SettingsPage() {
  const { apiUrl, apiKey, model, setConfig } = useConfigStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    setConfig({
      apiUrl: formData.get('apiUrl') as string,
      apiKey: formData.get('apiKey') as string,
      model: formData.get('model') as string,
    });
    alert('设置已保存');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">设置</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API 地址
          </label>
          <input
            type="text"
            name="apiUrl"
            defaultValue={apiUrl}
            placeholder="http://localhost:3000"
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Server API 地址，默认: http://localhost:3000
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            API Key
          </label>
          <input
            type="password"
            name="apiKey"
            defaultValue={apiKey}
            placeholder="sk-..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            LLM API Key，留空则使用 Server 配置
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            模型
          </label>
          <select
            name="model"
            defaultValue={model}
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="glm-4">GLM-4</option>
            <option value="glm-4-plus">GLM-4 Plus</option>
            <option value="glm-4-flash">GLM-4 Flash</option>
            <option value="glm-4-air">GLM-4 Air</option>
            <option value="moonshot-v1-8k">Moonshot v1 8k</option>
            <option value="moonshot-v1-32k">Moonshot v1 32k</option>
            <option value="moonshot-v1-128k">Moonshot v1 128k</option>
          </select>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            保存设置
          </button>
        </div>
      </form>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">说明</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• 设置保存在浏览器本地存储中</li>
          <li>• API Key 留空则使用 Server 端配置</li>
          <li>• 修改 API 地址后需要刷新页面</li>
        </ul>
      </div>
    </div>
  );
}
```

**Step 2: 提交**

```bash
git add packages/web/src/pages/SettingsPage.tsx
git commit -m "feat(web): implement settings page"
```

---

## Task 10: 移动端响应式优化

**Files:**
- Modify: `packages/web/src/components/SessionList.tsx`
- Modify: `packages/web/src/components/Layout.tsx`
- Modify: `packages/web/src/pages/ChatPage.tsx`

**Step 1: 更新 Layout 支持移动端**

修改 `packages/web/src/components/Layout.tsx`:
```typescript
import { Outlet, Link } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Agent Chat</h1>
          <div className="flex gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900 sm:hidden">
              聊天
            </Link>
            <Link to="/settings" className="text-gray-600 hover:text-gray-900">
              设置
            </Link>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}
```

**Step 2: 更新 SessionList 支持移动端**

修改 `packages/web/src/components/SessionList.tsx`:
```typescript
import { useSessionStore } from '../store/sessionStore';
import { SessionItem } from './SessionItem';

interface SessionListProps {
  onCreateSession: () => void;
  onClose?: () => void; // 移动端关闭侧边栏
}

export function SessionList({ onCreateSession, onClose }: SessionListProps) {
  const { sessions, activeSessionId, setActiveSession, deleteSession, isLoading } = useSessionStore();

  const handleSessionClick = (id: string) => {
    setActiveSession(id);
    onClose?.(); // 移动端关闭侧边栏
  };

  return (
    <div className="w-full sm:w-64 bg-white border-r flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="font-semibold text-gray-900 hidden sm:block">会话列表</h2>
        <button
          onClick={onCreateSession}
          className="w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm"
        >
          + 新建
        </button>
      </div>

      {isLoading && sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400 text-sm">加载中...</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              暂无会话
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => handleSessionClick(session.id)}
                onDelete={deleteSession}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: 更新 ChatPage 支持移动端**

修改 `packages/web/src/pages/ChatPage.tsx`:
```typescript
import { useEffect, useState } from 'react';
import { useSessionStore } from '../store/sessionStore';
import { SessionList } from '../components/SessionList';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { Loading } from '../components/Loading';

export function ChatPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  const {
    sessions,
    activeSessionId,
    activeSessionMessages,
    isLoading,
    error,
    fetchSessions,
    createSession,
    setActiveSession,
    sendMessage,
    clearError,
  } = useSessionStore();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (!isLoading && sessions.length === 0) {
      handleCreateSession();
    }
  }, [isLoading, sessions.length]);

  const handleCreateSession = async () => {
    setIsCreating(true);
    try {
      const session = await createSession(`会话 ${new Date().toLocaleString('zh-CN')}`);
      setActiveSession(session.id);
      setShowSessions(false); // 移动端创建后关闭列表
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!activeSessionId || isStreaming) return;

    setIsStreaming(true);
    clearError();

    try {
      for await (const _chunk of sendMessage(message)) {
        // 流式更新自动由 store 处理
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] relative">
      {/* 移动端会话列表遮罩 */}
      {showSessions && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 sm:hidden"
          onClick={() => setShowSessions(false)}
        />
      )}

      {/* 会话列表 */}
      <div
        className={`${
          showSessions ? 'translate-x-0' : '-translate-x-full'
        } sm:translate-x-0 fixed sm:relative z-30 h-full transition-transform`}
      >
        <SessionList
          onCreateSession={handleCreateSession}
          onClose={() => setShowSessions(false)}
        />
      </div>

      {/* 聊天区域 */}
      <div className="flex-1 flex flex-col w-full">
        {activeSessionId ? (
          <>
            <div className="bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-3">
              <button
                onClick={() => setShowSessions(true)}
                className="sm:hidden p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="font-semibold text-gray-900">
                {sessions.find((s) => s.id === activeSessionId)?.name || '聊天'}
              </h2>
            </div>

            <MessageList messages={activeSessionMessages} />

            {isStreaming && <Loading />}

            <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">选择或创建一个会话开始聊天</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: 测试移动端响应式**

```bash
# 测试移动端
bun run --filter @littlething/web dev
```

使用浏览器开发者工具切换到移动视图测试。

**Step 5: 提交**

```bash
git add packages/web/src/
git commit -m "feat(web): add mobile responsive design"
```

---

## Task 11: 添加根 package.json 脚本和文档

**Files:**
- Modify: `package.json` (root)
- Create: `packages/web/README.md`

**Step 1: 更新根 package.json**

修改根目录 `package.json`:
```json
{
  "name": "little-thing",
  "scripts": {
    "dev:server": "bun run --filter @littlething/server dev",
    "dev:cli": "bun run --filter @littlething/cli dev",
    "dev:web": "bun run --filter @littlething/web dev",
    "dev": "bun run dev:server & bun run dev:web"
  },
  "workspaces": ["packages/*"]
}
```

**Step 2: 创建 Web README**

创建 `packages/web/README.md`:
```markdown
# little thing Web UI

little thing 的 Web 用户界面。

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev:web
```bash
# 构建
bun run --filter @littlething/web build

# 预览构建结果
bun run --filter @littlething/web preview
```

## 功能

- 多会话管理
- 实时流式聊天
- 响应式设计（移动端友好）
- 本地配置存储

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS
- Zustand
- React Router v6
```

**Step 3: 测试完整开发流程**

```bash
# 测试同时启动 server 和 web
bun run dev
```

Expected: Server 和 Web 同时启动

**Step 4: 提交**

```bash
git add package.json packages/web/README.md
git commit -m "feat(web): add dev scripts and documentation"
```

---

## Task 12: 清理和优化

**Files:**
- Delete: `packages/web/src/test-api.ts` (临时测试文件)
- Create: `packages/web/.gitignore`

**Step 1: 删除临时文件**

```bash
rm -f packages/web/src/test-api.ts
```

**Step 2: 创建 .gitignore**

创建 `packages/web/.gitignore`:
```
# Logs
logs
*.log
npm-debug.log*
bun-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

**Step 3: 最终测试**

```bash
# 完整测试流程
bun run dev

# 访问 http://localhost:5173
# 测试：创建会话、发送消息、切换会话、删除会话、设置页面、移动端视图
```

**Step 4: 提交**

```bash
git add packages/web/
git commit -m "chore(web): cleanup and add gitignore"
```

---

## Task 13: 更新项目 README

**Files:**
- Modify: `README.md` (root)

**Step 1: 更新项目 README**

修改根目录 `README.md`:
```markdown
# little thing

基于 LLM 的智能助手平台，支持多会话管理和实时对话。

## 架构

```
little-thing/
├── packages/
│   ├── server/    # HTTP API 服务器 (@littlething/server)
│   ├── cli/       # 命令行客户端 (@littlething/cli)
│   ├── sdk/       # SDK 包 (@littlething/sdk)
│   └── web/       # Web 用户界面 (@littlething/web)
```

## 快速开始

### 1. 配置环境

```bash
cp .env.example .env
# 编辑 .env 文件，设置 LLM_API_KEY
```

### 2. 启动服务

```bash
# 安装依赖
bun install

# 启动 Server 和 Web
bun run dev
```

### 3. 访问

- Web UI: http://localhost:5173
- API Server: http://localhost:3000
- API 文档: http://localhost:3000/health

## 功能

- 多会话管理
- 实时流式输出
- 会话持久化
- Web UI 和 CLI 客户端
- 支持多个 LLM 提供商（GLM、Kimi 等）

## 开发

```bash
# 仅启动 Server
bun run dev:server

# 仅启动 Web
bun run dev:web

# 仅启动 CLI
bun run dev:cli
```

## 文档

- [架构设计](./docs/architecture/base.md)
- [Phase 1: 基础对话](./docs/plans/2025-03-01-phase1-basic-chat.md)
- [Phase 2: 会话管理](./docs/plans/2025-03-01-phase2-session-management.md)
- [Phase 3: Web UI](./docs/plans/2025-03-01-phase3-web-ui.md)
```

**Step 2: 提交**

```bash
git add README.md
git commit -m "docs: update project README with Web UI info"
```

---

## 验证清单

完成所有任务后，验证以下功能：

- [ ] Vite 开发服务器正常启动
- [ ] 路由切换正常（聊天页 <-> 设置页）
- [ ] 可以创建新会话
- [ ] 可以切换会话
- [ ] 可以删除会话
- [ ] 消息发送和接收正常
- [ ] 流式输出正常显示
- [ ] 设置保存到 localStorage
- [ ] 移动端视图正常
- [ ] 汉堡菜单正常工作

---

**完成标准:**

1. 所有任务完成且测试通过
2. 代码已提交到 git
3. 功能清单全部验证通过
4. 无控制台错误或警告

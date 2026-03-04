# AI 开发规范文档

## 项目概述

**little thing** 是一个通用型 LLM Agent 平台，支持多客户端（CLI/Web）和可扩展的工具系统。

## 技术栈

### Web 前端 (packages/web)

| 技术 | 版本 | 用途 |
|------|------|------|
| React | ^18.3.1 | UI 框架 |
| TypeScript | ^5.4.5 | 类型安全 |
| Vite | ^5.2.0 | 构建工具 |
| Tailwind CSS | ^3.4.1 | 样式系统 |
| shadcn/ui | - | UI 组件库 |
| Zustand | ^4.5.0 | 状态管理 |
| React Router | ^6.22.0 | 路由管理 |
| Lucide React | ^0.576.0 | 图标库 |

### 后端 (packages/server)

| 技术 | 用途 |
|------|------|
| Bun | Runtime |
| Hono | HTTP 框架 |
| WebSocket | 实时通信 |

### CLI (packages/cli)

| 技术 | 用途 |
|------|------|
| Bun | Runtime |
| readline | 交互式输入 |

## 代码风格规范

### 命名约定

```typescript
// 组件：PascalCase
export function ChatInput() {}
export function MessageBubble() {}

// 文件名：PascalCase for components
// ChatInput.tsx, MessageBubble.tsx

// 工具函数：camelCase
export function formatDate() {}
export function cn() {}

// 常量：UPPER_SNAKE_CASE
export const API_BASE_URL = '...';

// 类型/接口：PascalCase
interface ChatMessage {}
type SessionId = string;

// Store：xxxStore
export const useSessionStore = create<SessionStore>()(...)
export const useConfigStore = create<ConfigStore>()(...)
```

### 组件结构

```typescript
// 1. 导入顺序：外部 → 内部 → 类型
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Message } from '@/api/types';

// 2. 类型定义
interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

// 3. 组件实现
export function ChatInput({ onSend, disabled }: ChatInputProps) {
  // 3.1 Hooks
  const [message, setMessage] = useState('');
  
  // 3.2 派生状态
  
  // 3.3 回调函数
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message.trim());
      setMessage('');
    }
  };
  
  // 3.4 渲染
  return (
    <form onSubmit={handleSubmit}>
      {/* ... */}
    </form>
  );
}
```

### 样式规范

使用 Tailwind CSS + shadcn/ui 主题变量：

```typescript
// 推荐：使用主题变量
<div className="bg-background text-foreground border-border">
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    提交
  </button>
</div>

// 避免：硬编码颜色
<div className="bg-white text-gray-800 border-gray-200">
  <button className="bg-blue-500 text-white hover:bg-blue-600">
    提交
  </button>
</div>
```

### cn 工具函数使用

```typescript
import { cn } from '@/lib/utils';

// 条件样式
<div className={cn(
  'base-styles',
  isActive && 'active-styles',
  size === 'lg' && 'large-styles'
)} />
```

## 组件规范

### UI 组件 (src/components/ui/)

基础 UI 组件，来自 shadcn/ui：

- `button.tsx` - 按钮组件
- `input.tsx` - 输入框组件
- `textarea.tsx` - 文本域组件
- `card.tsx` - 卡片组件
- `scroll-area.tsx` - 滚动区域
- `separator.tsx` - 分隔线
- `avatar.tsx` - 头像组件
- `skeleton.tsx` - 骨架屏

### 业务组件 (src/components/)

业务相关组件：

- `ChatInput.tsx` - 聊天输入框
- `MessageBubble.tsx` - 消息气泡
- `MessageList.tsx` - 消息列表
- `SessionList.tsx` - 会话列表
- `SessionItem.tsx` - 会话项
- `Layout.tsx` - 布局组件
- `Loading.tsx` - 加载状态

### 组件导出

```typescript
// 推荐：命名导出
export function Button() {}
export function Input() {}

// 避免：默认导出（除非是页面组件）
export default function ChatPage() {}
```

## 状态管理规范

### Store 结构

```typescript
// src/store/sessionStore.ts
import { create } from 'zustand';

interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface SessionStore {
  sessions: Session[];
  currentSessionId: string | null;
  
  // Actions
  createSession: () => string;
  deleteSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  
  createSession: () => {
    const id = crypto.randomUUID();
    set((state) => ({
      sessions: [...state.sessions, { id, title: '新对话', messages: [], createdAt: Date.now() }],
      currentSessionId: id,
    }));
    return id;
  },
  
  // ...
}));
```

### Store 使用

```typescript
// 在组件中使用
function ChatPage() {
  const { sessions, currentSessionId, addMessage } = useSessionStore();
  
  // 选择器优化（避免不必要的重渲染）
  const currentSession = useSessionStore(
    (state) => state.sessions.find((s) => s.id === state.currentSessionId)
  );
}
```

## API 规范

### API 客户端

```typescript
// src/api/client.ts
const API_BASE = '/api';

export async function sendMessage(sessionId: string, content: string) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, content }),
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}
```

### 类型定义

```typescript
// src/api/types.ts
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}
```

## 文件结构规范

```
packages/web/src/
├── api/                    # API 相关
│   ├── client.ts          # API 客户端
│   └── types.ts           # API 类型定义
├── components/            # 业务组件
│   ├── ui/               # 基础 UI 组件 (shadcn)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   ├── ChatInput.tsx
│   ├── MessageBubble.tsx
│   └── ...
├── hooks/                 # 自定义 Hooks
├── lib/                   # 工具函数
│   └── utils.ts          # cn 等工具
├── pages/                 # 页面组件
│   ├── ChatPage.tsx
│   └── SettingsPage.tsx
├── store/                 # Zustand stores
│   ├── sessionStore.ts
│   └── configStore.ts
├── App.tsx               # 根组件
├── main.tsx              # 入口文件
└── index.css             # 全局样式
```

## 路径别名

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// 使用
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/sessionStore';
```

## Git 提交规范

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具相关

示例:
feat(web): add dark mode support
fix(server): handle streaming timeout
docs: update API documentation
```

## 错误处理

```typescript
// API 错误处理
try {
  const result = await sendMessage(sessionId, content);
} catch (error) {
  if (error instanceof Error) {
    console.error('Failed to send message:', error.message);
  }
}

// 组件错误边界
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary fallback={<div>Something went wrong</div>}>
  <ChatPage />
</ErrorBoundary>
```

## 性能优化

1. **使用 React.memo 避免不必要的重渲染**
2. **使用 Zustand 选择器优化状态订阅**
3. **虚拟列表处理大量消息**
4. **懒加载页面组件**

```typescript
// 懒加载
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// 选择器优化
const messages = useSessionStore((state) => 
  state.sessions.find(s => s.id === state.currentSessionId)?.messages ?? []
);
```

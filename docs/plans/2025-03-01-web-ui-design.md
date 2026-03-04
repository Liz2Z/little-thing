# Web UI 设计文档

## 目标

为 Agent Platform 构建现代化的 Web 用户界面，提供直观的聊天体验和会话管理功能。

## 架构

采用多页应用架构，使用 React + Vite + Tailwind CSS + Zustand，通过 HTTP API 与 Server 通信。

### 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router v6
- **HTTP 客户端**: 原生 fetch
- **网络请求**: 原生 fetch + AsyncIterator

## 页面布局

### 路由结构

```
/                 → 聊天主页（会话列表 + 聊天区域）
/settings         → 设置页（API 配置）
```

### 聊天主页布局

```
┌─────────────┬──────────────────────┐
│  会话列表   │    聊天区域          │
│            │                      │
│  + 新建     │  ┌──────────────┐   │
│            │  │ 消息列表     │   │
│  会话 1     │  │              │   │
│  会话 2     │  │  消息气泡     │   │
│  会话 3     │  │              │   │
│            │  └──────────────┘   │
│            │  ┌──────────────┐   │
│            │  │ 输入框       │   │
│            │  └──────────────┘   │
└─────────────┴──────────────────────┘

移动端：会话列表隐藏，汉堡菜单打开
```

### 设置页布局

```
┌──────────────────────────────┐
│  设置                         │
│                               │
│  API 地址        [________]  │
│  API Key        [________]  │
│  模型选择       [下拉菜单]   │
│                               │
│  [保存]                         │
└──────────────────────────────┘
```

## 组件架构

```
packages/web/
├── src/
│   ├── App.tsx              # 根组件，路由配置
│   ├── main.tsx             # 入口
│   ├── pages/               # 页面组件
│   │   ├── ChatPage.tsx    # 聊天主页
│   │   └── SettingsPage.tsx # 设置页
│   ├── components/          # 共享组件
│   │   ├── SessionList.tsx    # 会话列表
│   │   ├── SessionItem.tsx    # 会话项
│   │   ├── MessageList.tsx    # 消息列表
│   │   ├── MessageBubble.tsx # 消息气泡
│   │   ├── ChatInput.tsx     # 输入框
│   │   └── Loading.tsx       # 加载状态
│   ├── store/               # Zustand 状态
│   │   ├── sessionStore.ts   # 会话状态
│   │   └── configStore.ts    # 配置状态
│   ├── api/                 # API 调用
│   │   ├── client.ts        # 封装 fetch
│   │   └── types.ts         # 类型定义
│   └── hooks/               # 自定义 hooks
│       ├── useChat.ts       # 聊天逻辑
│       └── useSessions.ts   # 会话管理
```

## 状态管理

### sessionStore.ts

```typescript
interface Session {
  id: string;
  name: string;
  updatedAt: string;
  messageCount: number;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionMessages: Message[];
  isLoading: boolean;
  error: string | null;
}

// Actions
- fetchSessions()      // 获取会话列表
- createSession(name)    // 创建新会话
- deleteSession(id)     // 删除会话
- setActiveSession(id)  // 切换会话
- fetchSessionMessages(id) // 加载会话消息
- sendMessage(content)   // 发送消息（带流式处理）
```

### configStore.ts

```typescript
interface ConfigState {
  apiUrl: string;
  apiKey: string;
  model: string;

  // Actions
  setConfig(config)
  loadConfig()   // 从 localStorage 读取
}
```

## API 调用

### API Client

```typescript
class ApiClient {
  private baseUrl: string;

  // 会话相关
  getSessions()
  createSession(name)
  deleteSession(id)
  getSession(id)  // 获取会话详情+消息

  // 消息相关
  sendMessage(sessionId, content)  // 返回 AsyncGenerator 支持流式
}
```

### 流式输出实现

```typescript
async *sendMessage(sessionId, content) {
  const response = await fetch(`${baseUrl}/sessions/${sessionId}/chat/stream`, ...);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value);
  }
}
```

## 错误处理

- **网络错误**: 全局提示，自动重试 3 次
- **API 错误**: 显示具体错误信息
- **超时**: 30 秒超时，显示加载失败

## 迭代计划

### Phase 1: 基础框架
- [ ] Vite + React + Tailwind CSS 配置
- [ ] 路由配置（React Router）
- [ ] 基础布局结构

### Phase 2: 聊天功能
- [ ] 消息列表和气泡组件
- [ ] 输入框组件
- [ ] API 集成和 Zustand store
- [ ] 流式输出显示

### Phase 3: 会话管理
- [ ] 会话列表组件
- [ ] 创建/切换/删除会话
- [ ] 消息历史加载

### Phase 4: 设置页
- [ ] 设置页 UI
- [ ] 配置存储（localStorage）
- [ ] API 配置表单

### Phase 5: 优化
- [ ] 移动端响应式
- [ ] 加载状态和错误提示
- [ ] 打字动画效果

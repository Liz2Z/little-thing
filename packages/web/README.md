# little thing Web UI

little thing 的 Web 用户界面。

## 开发

```bash
# 从项目根目录运行
bun run dev:web

# 或者直接运行
cd packages/web
bun run dev
```

## 功能

- 多会话管理
- 实时流式聊天
- 响应式设计（支持移动端）
- 配置管理（API 地址、API Key、模型选择）

## 技术栈

- React 18
- TypeScript
- Vite
- TailwindCSS
- Zustand（状态管理）
- React Router

## 项目结构

```
src/
├── components/     # React 组件
│   ├── ChatInput.tsx
│   ├── Layout.tsx
│   ├── Loading.tsx
│   ├── MessageList.tsx
│   ├── SessionItem.tsx
│   └── SessionList.tsx
├── pages/          # 页面组件
│   ├── ChatPage.tsx
│   └── SettingsPage.tsx
├── store/          # 状态管理
│   ├── configStore.ts
│   └── sessionStore.ts
├── lib/            # 工具函数
│   └── api.ts
├── App.tsx
└── main.tsx
```

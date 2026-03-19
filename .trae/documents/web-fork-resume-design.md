# Web 端 Fork 和 Resume 功能实现计划

## 功能概述

为聊天界面添加 Fork（分叉）和 Resume（恢复）功能，通过消息右键菜单触发。

## 交互设计

### 1. 右键菜单设计

#### 用户消息右键菜单

```
├─ Fork from here（从此分叉）
├─ Resume from here（从此继续）
└─ Copy（复制）
```

#### AI 消息右键菜单

```
├─ Fork from here（从此分叉）
└─ Copy（复制）
```

**说明**：

* Resume 仅对用户消息显示，因为通常是"想重新问这个问题"

* Fork 对所有消息显示，可能想从 AI 的某个回答开始探索

### 2. 功能行为

#### Fork 流程

1. 用户右键点击消息，选择 "Fork from here"
2. 调用 API `POST /sessions/:id/fork`，传入 `messageId`
3. 后端创建新会话，复制该消息及之前的所有消息
4. 前端自动切换到新会话
5. 用户可以在新会话继续对话

#### Resume 流程

1. 用户右键点击自己的消息，选择 "Resume from here"
2. 调用 API `POST /sessions/:id/resume`，传入 `messageId`
3. 后端截断该消息之后的所有内容
4. 前端将该消息内容填入输入框
5. 用户可以直接发送或修改后重新发送

### 3. UI 组件设计

#### 使用 shadcn ui 组件

* `ContextMenu` - shadcn ui 内置右键菜单组件（`npx shadcn add context-menu`）

#### 修改组件

* `MessageBubble` - 添加右键菜单触发

* `ChatInput` - 支持外部设置输入值

* `sessionStore` - 添加 forkSession 和 resumeSession 方法

* `ApiClient` - 添加 fork 和 resume API 调用

### 4. 数据结构更新

#### API 类型更新

```typescript
// api/types.ts
export interface Message {
  id: string;  // 新增
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}
```

#### 状态管理更新

```typescript
// store/sessionStore.ts
interface SessionState {
  // ... 现有状态
  inputText: string;  // 新增：输入框内容
  setInputText: (text: string) => void;  // 新增
  forkSession: (sessionId: string, messageId: string) => Promise<Session>;
  resumeSession: (sessionId: string, messageId: string, messageContent: string) => Promise<void>;
}
```

### 5. 实现步骤

1. **更新 API 客户端**

   * 在 `api/client.ts` 添加 `forkSession` 和 `resumeSession` 方法

   * 更新 `api/types.ts` 添加 Message id 字段

2. **更新状态管理**

   * 在 `store/sessionStore.ts` 添加 inputText 状态

   * 添加 forkSession 和 resumeSession 方法

3. **安装 shadcn context-menu 组件**

   * 运行 `npx shadcn add context-menu`

4. **更新 MessageBubble**

   * 集成右键菜单

   * 根据消息角色显示不同菜单项

5. **更新 ChatInput**

   * 支持受控模式（value + onChange）

   * 支持外部设置值

6. **测试验证**

   * Fork 功能：右键 AI 消息 → Fork → 验证新会话创建和跳转

   * Resume 功能：右键用户消息 → Resume → 验证截断和输入框填充

### 6. 文件变更清单

| 文件                                                   | 变更类型 | 说明                                |
| ---------------------------------------------------- | ---- | --------------------------------- |
| `packages/web/src/api/types.ts`                      | 修改   | Message 添加 id 字段                  |
| `packages/web/src/api/client.ts`                     | 修改   | 添加 forkSession 和 resumeSession 方法 |
| `packages/web/src/store/sessionStore.ts`             | 修改   | 添加 inputText 状态和相关方法              |
| `packages/web/src/components/ui/context-menu.tsx` | 新增（shadcn） | shadcn context-menu 组件 |
| `packages/web/src/components/MessageBubble.tsx`      | 修改   | 集成右键菜单                            |
| `packages/web/src/components/ChatInput.tsx`          | 修改   | 支持受控模式                            |

### 7. 注意事项

1. **右键菜单定位** - 需要正确处理菜单位置，避免超出视口
2. **移动端适配** - 考虑长按触发菜单的交互
3. **加载状态** - Fork 和 Resume 操作需要显示加载状态
4. **错误处理** - 操作失败时显示友好提示


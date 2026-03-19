# Session Fork 和 Resume 功能实现计划

## 背景分析

当前 session 系统已经具备基础的 CRUD 能力：
- 创建、删除、重命名会话
- 添加消息
- 获取会话详情和列表

需要新增 **fork**（分叉）和 **resume**（恢复）能力，以支持：
- **Fork**: 从某个会话的特定消息位置创建一个新会话，保留该位置之前的所有消息历史
- **Resume**: 在已有会话的特定消息位置之后继续对话，可以选择性地截断该位置之后的消息

## 设计方案

### 1. 数据模型扩展

#### Message 扩展
在 `types.ts` 中为 Message 添加 ID 字段：

```typescript
export interface Message {
  id: string;                    // 新增：消息唯一标识
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}
```

#### SessionMeta 扩展
在 `types.ts` 中添加以下字段：

```typescript
export interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  systemPrompt?: string;
  // 新增字段
  parentSessionId?: string;      // 父会话 ID（fork 来源），存在即表示是 fork 会话
  forkedFromMessageId?: string;  // 从父会话的哪条消息分叉（使用消息 ID）
}
```

**说明**：
- 通过 `parentSessionId` 是否存在即可判断是否为 fork 会话，无需额外的 `isFork` 字段
- `forkedFromMessageId` 记录从父会话的哪条消息开始分叉

### 2. Store 层方法扩展

在 `SessionStore` 类中添加以下方法：

#### forkSession(sourceSessionId: string, messageId: string, name?: string): SessionMeta | null
- 功能：从指定会话的特定消息位置创建新会话
- 参数：
  - `sourceSessionId`: 源会话 ID
  - `messageId`: 消息 ID（包含该消息及之前的所有消息）
  - `name`: 新会话名称（可选）
- 逻辑：
  1. 验证源会话存在
  2. 获取源会话的消息列表
  3. 找到指定 messageId 的消息索引
  4. 截取该消息及之前的所有消息
  5. 创建新会话，复制消息到新会话（生成新的消息 ID）
  6. 设置 `parentSessionId` 和 `forkedFromMessageId`
  7. 返回新会话的 meta

#### resumeSession(sessionId: string, messageId: string): boolean
- 功能：在指定消息位置之后恢复对话，截断该消息之后的所有消息
- 参数：
  - `sessionId`: 会话 ID
  - `messageId`: 消息 ID（保留该消息及之前的所有消息）
- 逻辑：
  1. 验证会话存在
  2. 获取会话的消息列表
  3. 找到指定 messageId 的消息索引
  4. 截断消息文件，只保留该消息及之前的消息
  5. 更新 `messageCount` 和 `updatedAt`
  6. 返回操作结果

### 3. 存储层增强

#### JsonlStore 添加方法
- `loadRange(start: number, end?: number): T[]`: 加载指定范围的消息
- `truncate(count: number): boolean`: 截断文件，只保留前 count 条记录
- `overwrite(items: T[]): void`: 覆盖写入所有消息

### 4. API 路由扩展

#### POST /sessions/:id/fork
- 功能：Fork 会话
- 请求体：`{ messageId: string, name?: string }`
- 响应：`{ session: SessionMeta }`
- 错误：404（会话不存在），400（消息 ID 无效）

#### POST /sessions/:id/resume
- 功能：Resume 会话
- 请求体：`{ messageId: string }`
- 响应：`{ success: boolean }`
- 错误：404（会话不存在），400（消息 ID 无效）

### 5. 工具函数

添加消息 ID 生成函数：
```typescript
function generateMessageId(): string {
  return `msg_${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
```

### 6. 数据迁移脚本

创建 `scripts/migrate-messages.ts` 脚本，为所有现有消息添加 ID：
- 遍历所有会话的消息文件
- 为每条没有 id 的消息生成 `msg_` 前缀的 ID
- 覆盖写回文件

### 7. 实现步骤

1. **更新 types.ts**
   - 在 Message 接口中添加 id 字段
   - 在 SessionMeta 接口中添加 fork 相关字段

2. **增强 JsonlStore**
   - 添加 `loadRange` 方法
   - 添加 `truncate` 方法
   - 添加 `overwrite` 方法

3. **更新 SessionStore**
   - 添加消息 ID 生成逻辑（带 `msg_` 前缀）
   - 修改 `addMessage` 方法自动生成消息 ID
   - 添加 `forkSession` 方法
   - 添加 `resumeSession` 方法

4. **更新 routes.ts**
   - 添加 `/sessions/:id/fork` 路由
   - 添加 `/sessions/:id/resume` 路由

5. **创建数据迁移脚本**
   - 创建 `scripts/migrate-messages.ts`
   - 运行脚本迁移现有数据

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/server/src/session/types.ts` | 修改 | Message 添加 id 字段，SessionMeta 添加 fork 相关字段 |
| `packages/server/src/storage/jsonl-store.ts` | 修改 | 添加 loadRange、truncate、overwrite 方法 |
| `packages/server/src/session/store.ts` | 修改 | 添加 forkSession 和 resumeSession 方法，消息自动生成 ID |
| `packages/server/src/routes.ts` | 修改 | 添加 fork 和 resume API 路由 |
| `packages/server/scripts/migrate-messages.ts` | 新增 | 数据迁移脚本，为现有消息添加 ID |

## 注意事项

1. **消息 ID 生成**：使用 `msg_${Date.now()}-${random}` 格式，带 `msg_` 前缀
2. **数据迁移**：通过脚本一次性刷数据，代码不做兼容处理
3. **原子性**：fork 操作需要确保消息复制完整
4. **命名规范**：fork 会话默认命名为 `"{原会话名} (fork)"`

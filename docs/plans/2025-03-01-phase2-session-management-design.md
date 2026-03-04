# Phase 2: 会话管理设计文档

## 目标

实现会话持久化存储，支持多会话管理和消息历史。

## 架构

存储采用 JSON + JSONL 文件格式，按 XDG 规范存放：
- 数据目录：`~/.local/share/littlething/`
- 配置文件：`~/.config/littlething/`

## 数据模型

```typescript
// Message 结构
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// Session 元数据
interface SessionMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  systemPrompt?: string;
}

// 会话索引
interface SessionIndex {
  activeSessionId: string | null;
  sessions: Record<string, SessionMeta>;
}
```

## 存储方案

### 目录结构

```
~/.local/share/littlething/
├── sessions/
│   ├── index.json              # 会话元数据索引
│   └── {sessionId}.jsonl       # 各会话消息历史
```

### 文件格式

**index.json:**
```json
{
  "activeSessionId": "20250301-abc123",
  "sessions": {
    "20250301-abc123": {
      "id": "20250301-abc123",
      "name": "代码调试",
      "createdAt": "2025-03-01T10:00:00Z",
      "updatedAt": "2025-03-01T10:30:00Z",
      "messageCount": 10,
      "systemPrompt": "你是一个专业的编程助手"
    }
  }
}
```

**{sessionId}.jsonl:**
```jsonl
{"role":"system","content":"你是一个有帮助的助手","timestamp":"2025-03-01T10:00:00Z"}
{"role":"user","content":"你好","timestamp":"2025-03-01T10:00:05Z"}
{"role":"assistant","content":"你好！有什么可以帮助你的吗？","timestamp":"2025-03-01T10:00:06Z"}
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `/new [name]` | 创建新会话，可选命名 |
| `/list` | 显示所有会话列表 |
| `/switch <id>` | 切换到指定会话 |
| `/delete <id>` | 删除会话 |
| `/rename <name>` | 重命名当前会话 |
| `/clear` | 清空当前会话历史 |

## Server API

```
GET    /sessions              # 获取所有会话列表
POST   /sessions              # 创建新会话
GET    /sessions/:id          # 获取指定会话详情
POST   /sessions/:id/messages # 在指定会话中发送消息
DELETE /sessions/:id          # 删除会话
PUT    /sessions/:id          # 更新会话信息（重命名）
```

## 工作流程

1. **启动 CLI**: 读取 index.json，恢复上次活跃会话
2. **发送消息**: 追加到对应 jsonl 文件，更新 index.json
3. **切换会话**: 更新 activeSessionId，加载对应消息历史
4. **创建会话**: 生成新 ID，创建空 jsonl，更新 index

## 迭代计划

### Phase 2.1: 基础会话存储
- [ ] 实现 SessionStore 类（文件读写）
- [ ] 集成到 chat 流程（自动保存消息）

### Phase 2.2: 会话管理命令
- [ ] `/new` 创建会话
- [ ] `/list` 列出会话
- [ ] `/switch` 切换会话

### Phase 2.3: 高级功能
- [ ] `/delete` 删除会话
- [ ] `/rename` 重命名会话
- [ ] 显示消息历史在对话中

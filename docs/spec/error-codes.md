# Error Code 统一错误码系统设计规范

## 背景与收益

### 为什么需要统一错误码

**当前问题**：
- 错误返回格式不统一，路由层直接返回 `{ error: 'xxx' }` 字符串
- Agent 执行过程中会遇到多种错误边界（工具错误、LLM 错误、业务错误等）
- 前端/CLI 无法基于错误做程序化判断，只能展示字符串

**收益**：
1. **代码逻辑清晰**：错误码定义集中，一目了然
2. **前端处理方便**：可基于 `code` 字段做不同 UI 处理（toast 样式、跳转、重试按钮等）
3. **便于调试**：错误码自描述，无需查表
4. **可扩展**：`details` 字段可携带上下文信息（如哪个 sessionId 不存在）
5. **支持国际化**：`message` 可根据 code 映射到不同语言

### 错误类型预估

| 模块 | 错误示例 |
|------|----------|
| Session | `SESSION.NOT_FOUND` |
| Message | `MESSAGE.INVALID` |
| Agent - Tool | `AGENT.TOOL.FILE_NOT_FOUND`, `AGENT.TOOL.PERMISSION_DENIED` |
| Agent - LLM | `AGENT.LLM.RATE_LIMITED`, `AGENT.LLM.CONTEXT_TOO_LONG` |
| Agent - Loop | `AGENT.LOOP.MAX_ITERATIONS`, `AGENT.LOOP.ABORTED` |
| Internal | `INTERNAL.ERROR` |

## 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 覆盖范围 | server 全部 | API + Agent + Tools 统一处理 |
| Code 格式 | `SESSION.NOT_FOUND` | 大写 + 点号分隔，自描述，IDE 友好 |
| 响应结构 | `{ code, message, details }` | 简洁，details 可携带上下文 |
| 定义方式 | 枚举 + 工厂函数 | 类型安全，结构一致 |
| 创建方式 | 单一工厂函数 | 灵活，避免函数膨胀 |
| HTTP 状态码 | 标准 RESTful | 404/400/403 等，符合语义 |
| 错误处理 | throw + Hono onError | 服务层 throw，全局统一转换 |
| 文件位置 | `packages/server/src/errors/` | 可扩展 |

## 响应结构

```typescript
interface ErrorResponse {
  code: string;        // 错误码，如 'SESSION.NOT_FOUND'
  message: string;     // 人类可读的错误信息
  details: Record<string, unknown>;  // 上下文信息
}
```

**示例**：

```json
{
  "code": "SESSION.NOT_FOUND",
  "message": "会话不存在",
  "details": {
    "sessionId": "abc-123"
  }
}
```

## 错误码命名规范

### 格式

```
{MODULE}.{ERROR_TYPE}
```

- 全大写
- 点号分隔
- 模块名 + 具体错误类型

### 模块前缀

| 前缀 | 模块 | 说明 |
|------|------|------|
| `SESSION` | 会话管理 | 会话 CRUD 相关错误 |
| `MESSAGE` | 消息管理 | 消息相关错误 |
| `AGENT.TOOL` | Agent 工具执行 | 文件操作、命令执行等 |
| `AGENT.LLM` | Agent LLM 调用 | API 调用、响应解析等 |
| `AGENT.LOOP` | Agent 循环控制 | 迭代限制、中断等 |
| `INTERNAL` | 内部错误 | 未预期的系统错误 |

### 层级结构

```
SESSION
├── NOT_FOUND
└── ...

MESSAGE
├── INVALID
└── ...

AGENT
├── TOOL
│   ├── FILE_NOT_FOUND
│   ├── PERMISSION_DENIED
│   └── TIMEOUT
├── LLM
│   ├── RATE_LIMITED
│   ├── CONTEXT_TOO_LONG
│   └── PARSE_FAILED
└── LOOP
    ├── MAX_ITERATIONS
    └── ABORTED

INTERNAL
└── ERROR
```

## 文件结构

```
packages/server/src/errors/
└── index.ts           # 枚举定义 + 工厂函数 + AppError 类
```

## API 设计

```typescript
// 错误码枚举
export enum ErrorCode {
  // Session
  SESSION_NOT_FOUND = 'SESSION.NOT_FOUND',

  // Agent - Tool
  AGENT_TOOL_FILE_NOT_FOUND = 'AGENT.TOOL.FILE_NOT_FOUND',
  AGENT_TOOL_PERMISSION_DENIED = 'AGENT.TOOL.PERMISSION_DENIED',

  // Agent - LLM
  AGENT_LLM_RATE_LIMITED = 'AGENT.LLM.RATE_LIMITED',

  // Agent - Loop
  AGENT_LOOP_MAX_ITERATIONS = 'AGENT.LOOP.MAX_ITERATIONS',
  AGENT_LOOP_ABORTED = 'AGENT.LOOP.ABORTED',

  // Internal
  INTERNAL_ERROR = 'INTERNAL.ERROR',
}

// 错误元数据
interface ErrorMeta {
  status: number;      // HTTP 状态码
  message: string;     // 默认错误信息
}

// 错误元数据映射
export const ERROR_META: Record<ErrorCode, ErrorMeta> = {
  [ErrorCode.SESSION_NOT_FOUND]: {
    status: 404,
    message: '会话不存在',
  },
  // ...
};

// 自定义错误类
export class AppError extends Error {
  code: ErrorCode;
  status: number;
  details: Record<string, unknown>;

  constructor(code: ErrorCode, details: Record<string, unknown> = {}) {
    super(ERROR_META[code].message);
    this.code = code;
    this.status = ERROR_META[code].status;
    this.details = details;
  }
}

// 工厂函数
export function createError(
  code: ErrorCode,
  details: Record<string, unknown> = {}
): AppError {
  return new AppError(code, details);
}
```

## Hono 全局错误处理

```typescript
// server/src/index.ts
import { Hono } from 'hono';
import { AppError, createError, ErrorCode } from './errors';

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      code: err.code,
      message: err.message,
      details: err.details,
    }, err.status);
  }

  // 未预期的错误
  console.error('Unhandled error:', err);
  return c.json({
    code: ErrorCode.INTERNAL_ERROR,
    message: '服务器内部错误',
    details: {},
  }, 500);
});
```

## 使用示例

### 服务层

```typescript
// session/service.ts
import { createError, ErrorCode } from '../errors';

function getSession(id: string) {
  const session = store.get(id);
  if (!session) {
    throw createError(ErrorCode.SESSION_NOT_FOUND, { sessionId: id });
  }
  return session;
}
```

### 路由层

```typescript
// routes/session.ts
app.get('/:id', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getSession(id); // 可能 throw
  return c.json({ session });
});
```

### Agent 工具层

```typescript
// tools/read.ts
import { createError, ErrorCode } from '../errors';

async function readFile(path: string) {
  try {
    return await fs.readFile(path);
  } catch {
    throw createError(ErrorCode.AGENT_TOOL_FILE_NOT_FOUND, { path });
  }
}
```

## 实现步骤

1. **创建 errors 模块**
   - `packages/server/src/errors/index.ts`
   - 定义 ErrorCode 枚举
   - 定义 ERROR_META 映射
   - 实现 AppError 类
   - 实现 createError 工厂函数

2. **添加全局错误处理**
   - 在 `index.ts` 添加 `app.onError` 处理器

3. **改造现有代码**
   - 路由层 7 处错误返回改为 throw
   - Agent/Tools 内部错误按需改造

4. **更新 OpenAPI 文档**
   - 错误响应 schema 更新为统一格式

## 影响范围

| 文件 | 变更 |
|------|------|
| `src/errors/index.ts` | 新增 |
| `src/index.ts` | 添加 onError |
| `src/routes/session.ts` | 7 处错误返回改造 |
| `src/session/service.ts` | 内部错误改造 |
| `src/tools/*.ts` | 按需改造 |
| `src/agent/*.ts` | 按需改造 |

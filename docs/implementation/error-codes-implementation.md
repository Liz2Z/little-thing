# Error Code 统一错误码系统实施文档

## 实施概览

本文档基于 [error-codes.md](../spec/error-codes.md) 规范，提供完整的实施指导。

### 技术栈

- **运行时**: Bun
- **Web 框架**: Hono
- **类型系统**: TypeScript

---

## 文件结构

```
packages/server/src/errors/
├── index.ts        # 导出 + Hono onError 处理器
├── types.ts        # AppError 基类 + 语义化子类
└── codes.ts        # 错误码定义 + 元数据
```

---

## 实施步骤

### 步骤一：错误码定义 (codes.ts)

**文件路径**: `packages/server/src/errors/codes.ts`

```typescript
// ============================================
// 错误定义（元组：[code, status, message]）
// ============================================

export const SessionErrors = {
  NOT_FOUND: ['SESSION-1001', 404, '会话不存在'] as const,
  OR_MESSAGE_NOT_FOUND: ['SESSION-1002', 404, '会话或消息不存在'] as const,
};

export const AgentErrors = {
  MAX_ITERATIONS: ['AGENT-1001', 200, '达到最大迭代次数'] as const,
  ABORTED: ['AGENT-1002', 200, 'Agent 被中断'] as const,
};

export const ToolErrors = {
  FILE_NOT_FOUND: ['TOOL-1001', 400, '文件不存在'] as const,
  PERMISSION_DENIED: ['TOOL-1002', 403, '权限不足'] as const,
  INVALID_PATH: ['TOOL-1003', 400, '路径不合法'] as const,
  TIMEOUT: ['TOOL-1004', 408, '操作超时'] as const,
};

export const LlmErrors = {
  RATE_LIMITED: ['LLM-1001', 429, 'API 请求频率限制'] as const,
  CONTEXT_TOO_LONG: ['LLM-1002', 400, '上下文长度超限'] as const,
  PARSE_FAILED: ['LLM-1003', 500, '响应解析失败'] as const,
  UNAUTHORIZED: ['LLM-1004', 401, 'API 密钥无效'] as const,
};

export const InternalErrors = {
  ERROR: ['INTERNAL-1001', 500, '服务器内部错误'] as const,
};

// ============================================
// 类型
// ============================================

export type ErrorTuple = readonly [code: string, status: number, message: string];

export type ErrorCode =
  | typeof SessionErrors[keyof typeof SessionErrors][0]
  | typeof AgentErrors[keyof typeof AgentErrors][0]
  | typeof ToolErrors[keyof typeof ToolErrors][0]
  | typeof LlmErrors[keyof typeof LlmErrors][0]
  | typeof InternalErrors[keyof typeof InternalErrors][0];

// ============================================
// 错误响应类型
// ============================================

export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, unknown>;
}
```

**添加新错误只需一处**：
```typescript
export const ToolErrors = {
  // ...
  SOME_NEW_ERROR: ['TOOL-1005', 400, '新错误描述'] as const,
};
```

---

### 步骤二：错误类定义 (types.ts)

**文件路径**: `packages/server/src/errors/types.ts`

```typescript
import type { ErrorTuple, ErrorResponse } from './codes';

// ============================================
// 基类
// ============================================

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple[2]);
    this.name = 'AppError';
    this.code = tuple[0];
    this.status = tuple[1];
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================
// 语义化子类
// ============================================

export class NotFoundError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'ForbiddenError';
  }
}

export class InternalError extends AppError {
  constructor(tuple: ErrorTuple, details: Record<string, unknown> = {}) {
    super(tuple, details);
    this.name = 'InternalError';
  }
}

// ============================================
// 工具函数
// ============================================

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
```

---

### 步骤三：导出与处理器 (index.ts)

**文件路径**: `packages/server/src/errors/index.ts`

```typescript
export * from './codes';
export * from './types';

import type { Context } from 'hono';
import { AppError, InternalError } from './types';
import { InternalErrors } from './codes';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(err.toJSON(), err.status);
  }

  console.error('Unhandled error:', err);

  const internalError = new InternalError(InternalErrors.ERROR, {
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      originalMessage: err.message,
    }),
  });

  return c.json(internalError.toJSON(), internalError.status);
}
```

---

### 步骤四：注册全局错误处理器

**文件路径**: `packages/server/src/index.ts`

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { errorHandler } from './errors';
import { sessionRoutes, systemRoutes } from './routes';

const app = new Hono();

// 注册全局错误处理器
app.onError(errorHandler);

app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
  .route('/sessions', sessionRoutes)
  .route('/system', systemRoutes);

// ...
```

---

### 步骤五：服务层改造

**文件路径**: `packages/server/src/session/service.ts`

**改造前**:
```typescript
function getSession(id: string) {
  const session = store.get(id);
  if (!session) {
    return null;  // 由路由层处理
  }
  return session;
}
```

**改造后**:
```typescript
import { NotFoundError, SessionErrors } from '../errors';

function getSession(id: string) {
  const session = store.get(id);
  if (!session) {
    throw new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: id });
  }
  return session;
}
```

---

### 步骤六：路由层改造

**文件路径**: `packages/server/src/routes/session.ts`

**改造前**:
```typescript
app.get('/:id', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getSession(id);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  return c.json({ session });
});
```

**改造后**:
```typescript
app.get('/:id', (c) => {
  const id = c.req.param('id');
  const session = sessionService.getSession(id);  // throw 会被 onError 捕获
  return c.json({ session });
});
```

**需要改造的位置**（共 7 处）:

| 行号 | 原错误信息 | 错误常量 |
|------|-----------|----------|
| 115 | Session not found | `SessionErrors.NOT_FOUND` |
| 155 | Session not found | `SessionErrors.NOT_FOUND` |
| 198 | Session not found | `SessionErrors.NOT_FOUND` |
| 243 | Session or message not found | `SessionErrors.OR_MESSAGE_NOT_FOUND` |
| 286 | Session or message not found | `SessionErrors.OR_MESSAGE_NOT_FOUND` |
| 337 | Session not found | `SessionErrors.NOT_FOUND` |
| 392 | Session not found | `SessionErrors.NOT_FOUND` |

---

### 步骤七：Agent/Tools 改造

**Tools 改造示例** (`tools/read.ts`):

```typescript
import { ValidationError, ForbiddenError, ToolErrors } from '../errors';

export async function readFile(params: ReadParams) {
  const { path: filePath } = params;

  if (!isValidPath(filePath)) {
    throw new ValidationError(ToolErrors.INVALID_PATH, { path: filePath });
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new ValidationError(ToolErrors.FILE_NOT_FOUND, { path: filePath });
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      throw new ForbiddenError(ToolErrors.PERMISSION_DENIED, { path: filePath });
    }
    throw new ValidationError(ToolErrors.FILE_NOT_FOUND, {
      path: filePath,
      originalError: String(err),
    });
  }
}
```

**Agent 改造示例** (`agent/agent.ts`):

```typescript
import { ValidationError, AgentErrors } from '../errors';

async function runAgent(config: AgentConfig) {
  for (let i = 0; i < config.maxIterations; i++) {
    if (this.aborted) {
      throw new ValidationError(AgentErrors.ABORTED, {
        runId: this.runId,
        iteration: i,
      });
    }

    // ... agent 逻辑

    if (i === config.maxIterations - 1) {
      throw new ValidationError(AgentErrors.MAX_ITERATIONS, {
        runId: this.runId,
        maxIterations: config.maxIterations,
      });
    }
  }
}
```

---

### 步骤八：SSE 错误事件

**事件类型定义** (`events/types.ts`):

```typescript
import type { ErrorResponse } from '../errors';

export interface AgentErrorEvent {
  type: 'error';
  data: ErrorResponse;
}
```

**服务端发送错误** (`session/service.ts`):

```typescript
import { isAppError, InternalError, InternalErrors } from '../errors';

async function* chat(id: string, message: string): AsyncGenerator<AgentEvent> {
  try {
    // ... agent 逻辑
  } catch (err) {
    if (isAppError(err)) {
      yield { type: 'error', data: err.toJSON() };
    } else {
      const internalError = new InternalError(InternalErrors.ERROR);
      yield { type: 'error', data: internalError.toJSON() };
    }
  }
}
```

**SSE 响应示例**:
```
event: error
data: {"code":"TOOL-1001","message":"文件不存在","details":{"path":"/foo/bar"}}
```

---

## 测试

### 单元测试

**文件路径**: `packages/server/src/errors/__tests__/index.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { SessionErrors, ToolErrors, NotFoundError, ValidationError, isAppError } from '../index';

describe('Error definitions', () => {
  it('should have correct tuple structure', () => {
    expect(SessionErrors.NOT_FOUND).toEqual(['SESSION-1001', 404, '会话不存在']);
    expect(ToolErrors.FILE_NOT_FOUND).toEqual(['TOOL-1001', 400, '文件不存在']);
  });
});

describe('Error classes', () => {
  it('should create NotFoundError with correct properties', () => {
    const error = new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: 'abc-123' });

    expect(error.code).toBe('SESSION-1001');
    expect(error.status).toBe(404);
    expect(error.message).toBe('会话不存在');
    expect(error.details).toEqual({ sessionId: 'abc-123' });
    expect(error.name).toBe('NotFoundError');
  });

  it('should convert to JSON correctly', () => {
    const error = new NotFoundError(SessionErrors.NOT_FOUND, { sessionId: 'abc-123' });
    expect(error.toJSON()).toEqual({
      code: 'SESSION-1001',
      message: '会话不存在',
      details: { sessionId: 'abc-123' },
    });
  });
});

describe('isAppError', () => {
  it('should return true for AppError subclasses', () => {
    expect(isAppError(new NotFoundError(SessionErrors.NOT_FOUND))).toBe(true);
    expect(isAppError(new ValidationError(ToolErrors.INVALID_PATH))).toBe(true);
  });

  it('should return false for regular errors', () => {
    expect(isAppError(new Error('regular error'))).toBe(false);
  });
});
```

### 集成测试

**文件路径**: `packages/server/src/__tests__/error-handling.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import app from '../index';

describe('Error handling', () => {
  it('should return structured error for non-existent session', async () => {
    const res = await app.request('/sessions/non-existent-id');
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toHaveProperty('code', 'SESSION-1001');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('details');
  });
});
```

---

## 改造清单

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/errors/codes.ts` | 新增 | 错误码定义 + 元数据 |
| `src/errors/types.ts` | 新增 | AppError 基类 + 语义化子类 |
| `src/errors/index.ts` | 新增 | 导出 + errorHandler |
| `src/index.ts` | 修改 | 注册 onError |
| `src/routes/session.ts` | 修改 | 7 处错误返回改造 |
| `src/session/service.ts` | 修改 | 内部错误改用 throw |
| `src/tools/*.ts` | 修改 | 工具错误改用语义化错误类 |
| `src/agent/*.ts` | 修改 | Agent 错误改用语义化错误类 |
| `src/events/types.ts` | 修改 | 添加错误事件类型 |

### 测试文件

| 文件 | 说明 |
|------|------|
| `src/errors/__tests__/index.test.ts` | 错误模块单元测试 |
| `src/__tests__/error-handling.test.ts` | 错误处理集成测试 |

---

## 注意事项

### 生产环境安全

```typescript
// 仅在非生产环境暴露错误详情
...(process.env.NODE_ENV !== 'production' && {
  stack: err.stack,
  originalMessage: err.message,
})
```

### 错误日志

```typescript
export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    console.info(`[${err.code}] ${err.message}`, err.details);
  } else {
    console.error('Unhandled error:', err);
  }
  // ...
}
```

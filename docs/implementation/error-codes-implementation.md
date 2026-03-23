# Error Code 统一错误码系统实施文档

## 实施概览

本文档基于 [error-codes.md](../spec/error-codes.md) 规范，提供完整的实施指导。

### 实施范围

- 错误码定义与类型系统
- AppError 错误类实现
- Hono 全局错误处理器
- 现有代码改造
- 前端类型共享

### 技术栈

- **运行时**: Bun
- **Web 框架**: Hono
- **类型系统**: TypeScript `const` + `satisfies`

---

## 设计决策回顾

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Code 格式 | `SESSION.NOT_FOUND` | 大写 + 点号分隔，自描述 |
| 响应结构 | `{ code, message, details }` | 简洁，details 可携带上下文 |
| 定义方式 | `const` 对象 + `satisfies` | 避免 enum 冗余 |
| 创建方式 | 单一工厂函数 `createError()` | 灵活，避免函数膨胀 |
| HTTP 状态码 | 标准 RESTful | 404/400/403 等 |
| 错误处理 | throw + Hono onError | 服务层 throw，全局统一转换 |
| 国际化 | message 英文，前端翻译 | 服务端不关心语言 |

---

## 实施步骤

### 阶段一：错误码定义 (errors/index.ts)

**目标**: 创建错误码常量和类型

**文件路径**: `packages/server/src/errors/index.ts`

**实施要点**:

1. 使用 `const` 对象 + `as const satisfies` 避免 enum 冗余
2. 多层命名空间：`AGENT.TOOL.FILE_NOT_FOUND`
3. 导出类型供其他模块使用

**关键代码结构**:

```typescript
// ============================================
// 错误码定义
// ============================================

export const ErrorCode = {
  // Session
  SESSION_NOT_FOUND: 'SESSION.NOT_FOUND',

  // Message
  MESSAGE_INVALID: 'MESSAGE.INVALID',

  // Agent - Tool
  AGENT_TOOL_FILE_NOT_FOUND: 'AGENT.TOOL.FILE_NOT_FOUND',
  AGENT_TOOL_PERMISSION_DENIED: 'AGENT.TOOL.PERMISSION_DENIED',
  AGENT_TOOL_TIMEOUT: 'AGENT.TOOL.TIMEOUT',

  // Agent - LLM
  AGENT_LLM_RATE_LIMITED: 'AGENT.LLM.RATE_LIMITED',
  AGENT_LLM_CONTEXT_TOO_LONG: 'AGENT.LLM.CONTEXT_TOO_LONG',
  AGENT_LLM_PARSE_FAILED: 'AGENT.LLM.PARSE_FAILED',

  // Agent - Loop
  AGENT_LOOP_MAX_ITERATIONS: 'AGENT.LOOP.MAX_ITERATIONS',
  AGENT_LOOP_ABORTED: 'AGENT.LOOP.ABORTED',

  // Internal
  INTERNAL_ERROR: 'INTERNAL.ERROR',
} as const satisfies Record<string, string>;

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

// ============================================
// 错误元数据
// ============================================

interface ErrorMeta {
  status: number;   // HTTP 状态码
  message: string;  // 默认错误信息（英文）
}

export const ERROR_META: Record<ErrorCode, ErrorMeta> = {
  [ErrorCode.SESSION_NOT_FOUND]: {
    status: 404,
    message: 'Session not found',
  },
  [ErrorCode.MESSAGE_INVALID]: {
    status: 400,
    message: 'Invalid message',
  },
  [ErrorCode.AGENT_TOOL_FILE_NOT_FOUND]: {
    status: 404,
    message: 'File not found',
  },
  [ErrorCode.AGENT_TOOL_PERMISSION_DENIED]: {
    status: 403,
    message: 'Permission denied',
  },
  [ErrorCode.AGENT_TOOL_TIMEOUT]: {
    status: 408,
    message: 'Tool execution timeout',
  },
  [ErrorCode.AGENT_LLM_RATE_LIMITED]: {
    status: 429,
    message: 'LLM rate limited',
  },
  [ErrorCode.AGENT_LLM_CONTEXT_TOO_LONG]: {
    status: 400,
    message: 'Context too long',
  },
  [ErrorCode.AGENT_LLM_PARSE_FAILED]: {
    status: 500,
    message: 'Failed to parse LLM response',
  },
  [ErrorCode.AGENT_LOOP_MAX_ITERATIONS]: {
    status: 500,
    message: 'Max iterations reached',
  },
  [ErrorCode.AGENT_LOOP_ABORTED]: {
    status: 499,
    message: 'Agent aborted by user',
  },
  [ErrorCode.INTERNAL_ERROR]: {
    status: 500,
    message: 'Internal server error',
  },
};

// ============================================
// 错误响应类型
// ============================================

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown>;
}

// ============================================
// AppError 类
// ============================================

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: ErrorCode, details: Record<string, unknown> = {}) {
    super(ERROR_META[code].message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_META[code].status;
    this.details = details;

    // 确保原型链正确（TypeScript 编译到 ES5 时需要）
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 转换为 JSON 响应格式
   */
  toJSON(): ErrorResponse {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================
// 工厂函数
// ============================================

/**
 * 创建应用错误
 *
 * @example
 * throw createError(ErrorCode.SESSION_NOT_FOUND, { sessionId: 'abc-123' });
 */
export function createError(
  code: ErrorCode,
  details: Record<string, unknown> = {}
): AppError {
  return new AppError(code, details);
}

// ============================================
// 工具函数
// ============================================

/**
 * 判断是否为 AppError 实例
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 判断错误码是否属于某个命名空间
 *
 * @example
 * isErrorCodeOf(error.code, 'AGENT') // 判断是否为 Agent 相关错误
 * isErrorCodeOf(error.code, 'AGENT.TOOL') // 判断是否为 Agent Tool 错误
 */
export function isErrorCodeOf(code: ErrorCode, namespace: string): boolean {
  return code.startsWith(namespace + '.') || code === namespace;
}
```

**验证检查点**:
- [ ] 所有错误码符合 `MODULE.SUBMODULE.TYPE` 格式
- [ ] 每个错误码都有对应的 ERROR_META
- [ ] 类型导出正确
- [ ] `isAppError` 类型守卫工作正常

---

### 阶段二：Hono 全局错误处理

**目标**: 在 Hono 应用中统一处理错误

**文件路径**: `packages/server/src/index.ts`

**实施要点**:

1. 使用 `app.onError` 注册全局错误处理器
2. 区分 AppError 和未知错误
3. 未知错误记录日志并返回 INTERNAL_ERROR

**关键代码结构**:

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AppError, createError, ErrorCode, isAppError } from './errors';
import { sessionRoutes, systemRoutes } from './routes';

const app = new Hono();

// ============================================
// 全局错误处理器
// ============================================

app.onError((err, c) => {
  // 已知的应用错误
  if (isAppError(err)) {
    return c.json(err.toJSON(), err.status);
  }

  // 未知错误：记录日志并返回通用错误
  console.error('Unhandled error:', err);

  const internalError = createError(ErrorCode.INTERNAL_ERROR, {
    // 生产环境不暴露错误详情
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      originalMessage: err.message,
    }),
  });

  return c.json(internalError.toJSON(), internalError.status);
});

// ============================================
// 路由
// ============================================

app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
  .route('/sessions', sessionRoutes)
  .route('/system', systemRoutes);

// ============================================
// 启动服务
// ============================================

const PORT = process.env.PORT || 3000;

console.log(`Server running on http://localhost:${PORT}`);
console.log(`OpenAPI spec available at http://localhost:${PORT}/openapi.json`);

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

export { app };
```

**验证检查点**:
- [ ] AppError 正确转换为 JSON 响应
- [ ] 未知错误返回 INTERNAL_ERROR
- [ ] 开发环境包含错误详情，生产环境隐藏
- [ ] HTTP 状态码正确

---

### 阶段三：服务层改造

**目标**: 服务层使用 throw 抛出 AppError

**文件路径**: `packages/server/src/session/service.ts`

**改造前**:

```typescript
function getSession(id: string) {
  const session = store.get(id);
  if (!session) {
    return null; // 调用方需要处理 null
  }
  return session;
}
```

**改造后**:

```typescript
import { createError, ErrorCode } from '../errors';

function getSession(id: string) {
  const session = store.get(id);
  if (!session) {
    throw createError(ErrorCode.SESSION_NOT_FOUND, { sessionId: id });
  }
  return session;
}
```

**验证检查点**:
- [ ] 所有业务错误使用 createError
- [ ] details 包含有用的上下文信息
- [ ] 不再返回 null 表示错误

---

### 阶段四：路由层改造

**目标**: 路由层简化，不再处理错误

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
  const session = sessionService.getSession(id); // 可能 throw
  return c.json({ session });
});
```

**需要改造的位置**（共 7 处）:

| 行号 | 当前错误信息 | 新错误码 |
|------|-------------|----------|
| 115 | `Session not found` | `SESSION_NOT_FOUND` |
| 155 | `Session not found` | `SESSION_NOT_FOUND` |
| 198 | `Session not found` | `SESSION_NOT_FOUND` |
| 243 | `Session or message not found` | `SESSION_NOT_FOUND` 或新增 `MESSAGE_NOT_FOUND` |
| 286 | `Session or message not found` | `SESSION_NOT_FOUND` 或新增 `MESSAGE_NOT_FOUND` |
| 337 | `Session not found` | `SESSION_NOT_FOUND` |
| 392 | `Session not found` | `SESSION_NOT_FOUND` |

**验证检查点**:
- [ ] 所有 `c.json({ error: ... }, xxx)` 已移除
- [ ] 路由逻辑简洁，只处理成功情况
- [ ] 错误处理统一由 onError 完成

---

### 阶段五：Agent/Tools 改造

**目标**: Agent 和 Tools 使用统一的错误码

**文件路径**: `packages/server/src/tools/*.ts`, `packages/server/src/agent/*.ts`

**Tools 改造示例** (`tools/read.ts`):

```typescript
import { createError, ErrorCode } from '../errors';

export async function readFile(params: ReadParams) {
  const { path: filePath } = params;

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw createError(ErrorCode.AGENT_TOOL_FILE_NOT_FOUND, {
        path: filePath,
      });
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      throw createError(ErrorCode.AGENT_TOOL_PERMISSION_DENIED, {
        path: filePath,
      });
    }
    // 其他错误也包装
    throw createError(ErrorCode.AGENT_TOOL_FILE_NOT_FOUND, {
      path: filePath,
      originalError: String(err),
    });
  }
}
```

**Agent 改造示例** (`agent/agent.ts`):

```typescript
import { createError, ErrorCode } from '../errors';

async function runAgent(config: AgentConfig) {
  for (let i = 0; i < config.maxIterations; i++) {
    if (this.aborted) {
      throw createError(ErrorCode.AGENT_LOOP_ABORTED, {
        runId: this.runId,
        iteration: i,
      });
    }

    // ... agent 逻辑

    if (i === config.maxIterations - 1) {
      throw createError(ErrorCode.AGENT_LOOP_MAX_ITERATIONS, {
        runId: this.runId,
        maxIterations: config.maxIterations,
      });
    }
  }
}
```

**验证检查点**:
- [ ] 工具执行错误使用 `AGENT.TOOL.*` 错误码
- [ ] LLM 调用错误使用 `AGENT.LLM.*` 错误码
- [ ] 循环控制错误使用 `AGENT.LOOP.*` 错误码
- [ ] details 包含有用的调试信息

---

### 阶段六：前端类型共享

**目标**: 前端可以直接使用 server 的错误码类型

**文件路径**: `packages/server/package.json`

**配置 exports**:

```json
{
  "name": "@littlething/server",
  "exports": {
    ".": "./src/index.ts",
    "./errors": "./src/errors/index.ts"
  }
}
```

**前端使用** (`packages/web/src/lib/errors.ts`):

```typescript
import { ErrorCode, type ErrorResponse } from '@littlething/server/errors';

// 国际化映射
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.SESSION_NOT_FOUND]: '会话不存在',
  [ErrorCode.MESSAGE_INVALID]: '消息格式无效',
  [ErrorCode.AGENT_TOOL_FILE_NOT_FOUND]: '文件不存在',
  [ErrorCode.AGENT_TOOL_PERMISSION_DENIED]: '没有权限',
  [ErrorCode.AGENT_TOOL_TIMEOUT]: '操作超时',
  [ErrorCode.AGENT_LLM_RATE_LIMITED]: '请求过于频繁，请稍后重试',
  [ErrorCode.AGENT_LLM_CONTEXT_TOO_LONG]: '对话内容过长',
  [ErrorCode.AGENT_LLM_PARSE_FAILED]: 'AI 响应解析失败',
  [ErrorCode.AGENT_LOOP_MAX_ITERATIONS]: 'AI 思考次数过多',
  [ErrorCode.AGENT_LOOP_ABORTED]: '操作已取消',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误',
};

/**
 * 获取本地化的错误信息
 */
export function getLocalizedError(error: ErrorResponse): string {
  return ERROR_MESSAGES[error.code] || error.message;
}

/**
 * 判断是否为可重试的错误
 */
export function isRetryableError(code: ErrorCode): boolean {
  return [
    ErrorCode.AGENT_LLM_RATE_LIMITED,
    ErrorCode.AGENT_TOOL_TIMEOUT,
  ].includes(code);
}

/**
 * 判断错误码是否属于某个命名空间
 */
export function isAgentError(code: ErrorCode): boolean {
  return code.startsWith('AGENT.');
}
```

**前端组件使用示例**:

```typescript
// 错误处理
eventSource.addEventListener('error', (e) => {
  const error: ErrorResponse = JSON.parse(e.data);

  if (isRetryableError(error.code)) {
    toast.error(getLocalizedError(error), {
      action: { label: '重试', onClick: retry },
    });
  } else {
    toast.error(getLocalizedError(error));
  }
});
```

**验证检查点**:
- [ ] 前端可以导入 ErrorCode 类型
- [ ] 国际化映射完整
- [ ] 类型检查正常工作

---

### 阶段七：SSE 错误格式

**目标**: Agent 错误通过 SSE 返回时使用统一格式

**SSE 事件类型定义** (`packages/server/src/events/types.ts`):

```typescript
import { ErrorResponse } from '../errors';

// Agent 事件类型
export type AgentEventType =
  | 'thinking'      // AI 思考中
  | 'tool_call'     // 工具调用
  | 'tool_result'   // 工具结果
  | 'message'       // 消息
  | 'error'         // 错误
  | 'done';         // 完成

export interface AgentEvent {
  type: AgentEventType;
  data: unknown;
}

export interface AgentErrorEvent extends AgentEvent {
  type: 'error';
  data: ErrorResponse;
}
```

**服务端发送错误** (`packages/server/src/session/service.ts`):

```typescript
async function* chat(id: string, message: string): AsyncGenerator<AgentEvent> {
  try {
    // ... agent 逻辑
  } catch (err) {
    if (isAppError(err)) {
      yield {
        type: 'error',
        data: err.toJSON(),
      };
    } else {
      const internalError = createError(ErrorCode.INTERNAL_ERROR);
      yield {
        type: 'error',
        data: internalError.toJSON(),
      };
    }
  }
}
```

**SSE 响应示例**:

```
event: thinking
data: {"type":"thinking","data":"正在思考..."}

event: tool_call
data: {"type":"tool_call","data":{"tool":"read","args":{"path":"/foo/bar"}}}

event: error
data: {"code":"AGENT.TOOL.FILE_NOT_FOUND","message":"File not found","details":{"path":"/foo/bar"}}

event: done
data: {"type":"done","data":{}}
```

**验证检查点**:
- [ ] SSE 错误事件使用 `event: error`
- [ ] 错误数据格式与 HTTP 响应一致
- [ ] 前端可以正确解析

---

## 测试策略

### 单元测试

**文件路径**: `packages/server/src/errors/__tests__/index.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import {
  ErrorCode,
  ERROR_META,
  AppError,
  createError,
  isAppError,
  isErrorCodeOf,
} from '../index';

describe('ErrorCode', () => {
  it('should have all codes defined', () => {
    expect(ErrorCode.SESSION_NOT_FOUND).toBe('SESSION.NOT_FOUND');
    expect(ErrorCode.AGENT_TOOL_FILE_NOT_FOUND).toBe('AGENT.TOOL.FILE_NOT_FOUND');
  });

  it('should have corresponding meta for each code', () => {
    const codes = Object.values(ErrorCode);
    for (const code of codes) {
      expect(ERROR_META[code]).toBeDefined();
      expect(ERROR_META[code].status).toBeGreaterThanOrEqual(400);
      expect(ERROR_META[code].message).toBeTruthy();
    }
  });
});

describe('AppError', () => {
  it('should create error with correct properties', () => {
    const error = createError(ErrorCode.SESSION_NOT_FOUND, { sessionId: 'abc-123' });

    expect(error.code).toBe('SESSION.NOT_FOUND');
    expect(error.status).toBe(404);
    expect(error.message).toBe('Session not found');
    expect(error.details).toEqual({ sessionId: 'abc-123' });
  });

  it('should convert to JSON correctly', () => {
    const error = createError(ErrorCode.SESSION_NOT_FOUND, { sessionId: 'abc-123' });
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'SESSION.NOT_FOUND',
      message: 'Session not found',
      details: { sessionId: 'abc-123' },
    });
  });
});

describe('isAppError', () => {
  it('should return true for AppError instances', () => {
    const error = createError(ErrorCode.SESSION_NOT_FOUND);
    expect(isAppError(error)).toBe(true);
  });

  it('should return false for regular errors', () => {
    const error = new Error('regular error');
    expect(isAppError(error)).toBe(false);
  });
});

describe('isErrorCodeOf', () => {
  it('should match namespace prefix', () => {
    expect(isErrorCodeOf('AGENT.TOOL.FILE_NOT_FOUND', 'AGENT')).toBe(true);
    expect(isErrorCodeOf('AGENT.TOOL.FILE_NOT_FOUND', 'AGENT.TOOL')).toBe(true);
    expect(isErrorCodeOf('AGENT.TOOL.FILE_NOT_FOUND', 'SESSION')).toBe(false);
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
    expect(body).toHaveProperty('code', 'SESSION.NOT_FOUND');
    expect(body).toHaveProperty('message');
    expect(body).toHaveProperty('details');
    expect(body.details).toHaveProperty('sessionId', 'non-existent-id');
  });

  it('should return internal error for unexpected errors', async () => {
    // 触发一个会抛出未预期错误的请求
    const res = await app.request('/some-broken-endpoint');
    const body = await res.json();

    expect(res.status).toBe(404); // 或 500，取决于路由配置
  });
});
```

---

## 改造清单

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/errors/index.ts` | 新增 | 错误码定义、AppError 类、工具函数 |
| `src/index.ts` | 修改 | 添加 onError 处理器 |
| `src/routes/session.ts` | 修改 | 7 处错误返回改造 |
| `src/session/service.ts` | 修改 | 内部错误改用 throw |
| `src/tools/*.ts` | 修改 | 工具错误改用 AGENT.TOOL.* |
| `src/agent/*.ts` | 修改 | Agent 错误改用 AGENT.* |
| `src/events/types.ts` | 修改 | 添加错误事件类型 |
| `package.json` | 修改 | 添加 `./errors` export |

### 测试文件

| 文件 | 说明 |
|------|------|
| `src/errors/__tests__/index.test.ts` | 错误模块单元测试 |
| `src/__tests__/error-handling.test.ts` | 错误处理集成测试 |

---

## 实施时间线

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | 错误码定义 | 1 小时 |
| 2 | Hono 全局错误处理 | 0.5 小时 |
| 3 | 服务层改造 | 1 小时 |
| 4 | 路由层改造 | 1 小时 |
| 5 | Agent/Tools 改造 | 2 小时 |
| 6 | 前端类型共享 | 0.5 小时 |
| 7 | SSE 错误格式 | 1 小时 |
| 8 | 单元测试 | 1.5 小时 |
| 9 | 集成测试 | 1 小时 |
| **总计** | | **9.5 小时** |

---

## 注意事项

### details 类型安全

当前设计使用 `Record<string, unknown>`，不提供编译时类型检查。如果未来需要类型安全的 details，可以考虑：

```typescript
// 未来可选的增强
type ErrorDetailsMap = {
  [ErrorCode.SESSION_NOT_FOUND]: { sessionId: string };
  [ErrorCode.AGENT_TOOL_FILE_NOT_FOUND]: { path: string };
  // ...
};

function createError<K extends ErrorCode>(
  code: K,
  details: ErrorDetailsMap[K]
): AppError;
```

但目前项目规模不大，运行时检查足够。

### 错误信息敏感度

生产环境不应暴露内部错误详情：

```typescript
// 开发环境
if (process.env.NODE_ENV !== 'production') {
  details.stack = err.stack;
}
```

### 日志记录

建议在 onError 中记录错误日志：

```typescript
app.onError((err, c) => {
  if (isAppError(err)) {
    // 业务错误，记录 info 级别
    console.info(`[${err.code}] ${err.message}`, err.details);
  } else {
    // 未知错误，记录 error 级别
    console.error('Unhandled error:', err);
  }
  // ...
});
```

---

## 参考资料

- [Hono 错误处理文档](https://hono.dev/docs/api/hono#error-handling)
- [TypeScript satisfies 操作符](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html#the-satisfies-operator)
- [规范文档](../spec/error-codes.md)

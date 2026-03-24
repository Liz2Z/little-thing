# Error Code 统一错误码系统

## 概述

为 server 端建立统一的错误码系统，覆盖 API、Agent、Tools、LLM 等所有模块，提供结构化的错误响应。

## 背景

### 当前问题

1. 错误返回格式不统一，路由层直接返回 `{ error: 'xxx' }` 字符串
2. Agent 执行过程中会遇到多种错误边界（工具错误、LLM 错误、业务错误等），缺乏统一处理
3. 前端/CLI 无法基于错误做程序化判断，只能展示字符串
4. 缺乏国际化支持基础

### 目标

1. 统一错误响应格式
2. 提供可程序化判断的错误码
3. 支持上下文信息传递
4. 为国际化奠定基础

## 功能需求

### FR-1 错误响应格式

所有 API 错误响应必须遵循统一格式：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 是 | 错误码，格式为 `{MODULE}-{NUMBER}` |
| message | string | 是 | 人类可读的错误信息 |
| details | object | 是 | 上下文信息，可为空对象 |

**响应示例**：

```json
{
  "code": "SESSION-1001",
  "message": "会话不存在",
  "details": {
    "sessionId": "abc-123"
  }
}
```

### FR-2 错误码规范

#### 命名格式

```
{MODULE}-{NUMBER}
```

- 模块名：全大写
- 分隔符：连字符 `-`
- 编号：每个模块独立编号，从 1001 开始递增

#### 模块定义

| 模块 | 前缀 | 说明 |
|------|------|------|
| 会话管理 | SESSION | 会话 CRUD 相关错误 |
| 消息管理 | MESSAGE | 消息相关错误 |
| Agent 循环 | AGENT | 迭代限制、中断等 |
| Agent 工具 | TOOL | 文件操作、命令执行等 |
| LLM 调用 | LLM | API 调用、响应解析等 |
| 内部错误 | INTERNAL | 未预期的系统错误 |

### FR-3 错误码定义

错误码以元组形式定义：`[code, status, message]`

#### SessionErrors

| 常量 | Code | 说明 | Status |
|------|------|------|--------|
| NOT_FOUND | SESSION-1001 | 会话不存在 | 404 |
| OR_MESSAGE_NOT_FOUND | SESSION-1002 | 会话或消息不存在 | 404 |

#### AgentErrors

| 常量 | Code | 说明 | Status |
|------|------|------|--------|
| MAX_ITERATIONS | AGENT-1001 | 达到最大迭代次数 | 200 |
| ABORTED | AGENT-1002 | Agent 被中断 | 200 |

#### ToolErrors

| 常量 | Code | 说明 | Status |
|------|------|------|--------|
| FILE_NOT_FOUND | TOOL-1001 | 文件不存在 | 400 |
| PERMISSION_DENIED | TOOL-1002 | 权限不足 | 403 |
| INVALID_PATH | TOOL-1003 | 路径不合法 | 400 |
| TIMEOUT | TOOL-1004 | 操作超时 | 408 |

#### LlmErrors

| 常量 | Code | 说明 | Status |
|------|------|------|--------|
| RATE_LIMITED | LLM-1001 | API 请求频率限制 | 429 |
| CONTEXT_TOO_LONG | LLM-1002 | 上下文长度超限 | 400 |
| PARSE_FAILED | LLM-1003 | 响应解析失败 | 500 |
| UNAUTHORIZED | LLM-1004 | API 密钥无效 | 401 |

#### InternalErrors

| 常量 | Code | 说明 | Status |
|------|------|------|--------|
| ERROR | INTERNAL-1001 | 服务器内部错误 | 500 |

### FR-4 错误类设计

按 HTTP 语义提供错误类，便于代码中语义化地抛出错误：

| 错误类 | HTTP Status | 使用场景 |
|--------|-------------|----------|
| NotFoundError | 404 | 资源不存在 |
| ValidationError | 400 | 参数校验失败 |
| UnauthorizedError | 401 | 认证失败 |
| ForbiddenError | 403 | 权限不足 |
| InternalError | 500 | 内部错误 |

### FR-5 全局错误处理

- 所有错误通过全局错误处理器统一捕获并转换
- 未预期的异常返回 `INTERNAL-1001`

## 非功能需求

### NFR-1 类型安全

错误码必须在 TypeScript 中有完整的类型定义，支持 IDE 自动补全。

### NFR-2 调用栈保留

错误创建时必须保留真实的调用栈信息，不能被工厂函数污染。

## 约束

1. 覆盖范围仅限于 `packages/server`
2. HTTP 状态码遵循 RESTful 规范
3. 新增错误码需更新本文档

## 影响范围

| 文件/目录 | 变更类型 |
|-----------|----------|
| `src/errors/` | 新增 |
| `src/index.ts` | 修改（注册错误处理器） |
| `src/routes/*.ts` | 修改（错误返回改造） |
| `src/session/*.ts` | 修改（内部错误改造） |
| `src/tools/*.ts` | 修改（工具错误改造） |
| `src/agent/*.ts` | 修改（Agent 错误改造） |
| `src/providers/*.ts` | 修改（LLM 错误改造） |

# Settings 配置系统实施文档

## 实施概览

本文档基于 [settings.md](../spec/settings.md) 规范，提供完整的实施指导。

### 实施范围

- Zod Schema 定义与类型系统
- 配置加载与深度合并
- 环境变量替换
- 错误处理
- 单元测试

### 技术栈

- **运行时**: Bun
- **验证**: Zod v4
- **类型系统**: TypeScript

---

## 设计决策回顾

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 配置归属 | 纯服务端 | 所有读写逻辑由 server 处理，前端不感知 |
| API 暴露 | 不暴露 | Settings 是内部实现，无对外 API |
| 加载时机 | 启动时一次性加载 | 简单可靠，变更需重启 |
| 环境变量替换 | 仅字符串值 | 避免类型转换歧义 |
| 配置缺失 | 使用默认值 | 开箱即用，无需强制创建配置文件 |
| 模块位置 | `packages/server/src/config/` | 服务端内部使用，无跨包共享需求 |

---

## 实施步骤

### 阶段一：Schema 定义 (config/schema.ts)

**目标**: 创建 Zod schema，作为唯一的默认值来源

**文件路径**: `packages/server/src/config/schema.ts`

**实施要点**:

1. 使用 `.default()` 定义所有默认值
2. 消息格式风格使用 enum
3. 数值类型设置合理的 min/max 约束

**关键代码结构**:

```typescript
import { z } from 'zod';

const messageStyleSchema = z.enum([
  'anthropic-messages',
  'openai-completions',
  'gemini-generateContent',
]).default('anthropic-messages');

const llmSchema = z.object({
  name: z.string().default('default'),
  messageStyle: messageStyleSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().default('glm-4.7'),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3),
});

const uiSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().min(12).max(24).default(14),
});

export const settingsSchema = z.object({
  llm: llmSchema,
  ui: uiSchema,
});
```

**验证检查点**:
- [ ] 所有字段都有默认值
- [ ] 数值类型有合理的约束
- [ ] 枚举值定义完整

---

### 阶段二：类型导出 (config/types.ts)

**目标**: 导出 TypeScript 类型

**文件路径**: `packages/server/src/config/types.ts`

**关键代码结构**:

```typescript
import { z } from 'zod';
import { settingsSchema } from './schema';

export type Settings = z.infer<typeof settingsSchema>;
export type LLMConfig = Settings['llm'];
export type UIConfig = Settings['ui'];
export type MessageStyle = LLMConfig['messageStyle'];
export type Theme = UIConfig['theme'];
```

**验证检查点**:
- [ ] 类型推导正确
- [ ] 子类型导出完整

---

### 阶段三：环境变量替换 (config/env.ts)

**目标**: 实现环境变量替换逻辑

**文件路径**: `packages/server/src/config/env.ts`

**实施要点**:

1. 支持 `${VAR}` 语法
2. 支持 `${VAR:-default}` 语法
3. 仅替换字符串值

**关键代码结构**:

```typescript
const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

export function replaceEnvVars(value: string): string {
  return value.replace(ENV_VAR_PATTERN, (_, expr: string) => {
    const [varName, defaultValue] = expr.split(':-');
    const envValue = process.env[varName];
    
    if (envValue !== undefined) {
      return envValue;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    throw new ConfigEnvError(varName);
  });
}

export function deepReplaceEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepReplaceEnvVars);
  }
  
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplaceEnvVars(value);
    }
    return result;
  }
  
  return obj;
}
```

**验证检查点**:
- [ ] `${VAR}` 语法正确替换
- [ ] `${VAR:-default}` 语法正确处理
- [ ] 缺失环境变量抛出 ConfigEnvError

---

### 阶段四：配置加载器 (config/loader.ts)

**目标**: 实现配置加载和深度合并

**文件路径**: `packages/server/src/config/loader.ts`

**实施要点**:

1. 全局配置路径: `~/.config/littlething/settings.json`
2. 局部配置路径: `./.littlething/settings.json`
3. 深度合并策略
4. 文件不存在时使用默认值

**关键代码结构**:

```typescript
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { settingsSchema } from './schema';
import { deepReplaceEnvVars } from './env';
import type { Settings } from './types';

const DEFAULT_GLOBAL_PATH = join(homedir(), '.config', 'littlething', 'settings.json');
const DEFAULT_PROJECT_PATH = join(process.cwd(), '.littlething', 'settings.json');

export async function loadConfigFile(path: string): Promise<unknown> {
  if (!existsSync(path)) {
    return {};
  }
  
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

export function deepMerge<T extends Record<string, unknown>>(
  global: T,
  local: Partial<T>
): T {
  const result = { ...global };
  
  for (const key of Object.keys(local) as (keyof T)[]) {
    const globalValue = global[key];
    const localValue = local[key];
    
    if (
      localValue &&
      typeof localValue === 'object' &&
      !Array.isArray(localValue) &&
      globalValue &&
      typeof globalValue === 'object' &&
      !Array.isArray(globalValue)
    ) {
      result[key] = deepMerge(
        globalValue as Record<string, unknown>,
        localValue as Record<string, unknown>
      ) as T[keyof T];
    } else {
      result[key] = localValue as T[keyof T];
    }
  }
  
  return result;
}

export async function loadConfig(options?: {
  globalPath?: string;
  projectPath?: string;
}): Promise<Settings> {
  const globalPath = options?.globalPath ?? DEFAULT_GLOBAL_PATH;
  const projectPath = options?.projectPath ?? DEFAULT_PROJECT_PATH;
  
  const globalConfig = await loadConfigFile(globalPath);
  const projectConfig = await loadConfigFile(projectPath);
  
  const merged = deepMerge(
    globalConfig as Record<string, unknown>,
    projectConfig as Record<string, unknown>
  );
  
  const withEnvVars = deepReplaceEnvVars(merged);
  
  return settingsSchema.parse(withEnvVars);
}
```

**验证检查点**:
- [ ] 全局配置正确加载
- [ ] 局部配置正确加载
- [ ] 深度合并逻辑正确
- [ ] 文件不存在时不报错

---

### 阶段五：主入口 (config/index.ts)

**目标**: 导出配置对象和 API

**文件路径**: `packages/server/src/config/index.ts`

**关键代码结构**:

```typescript
import { settingsSchema } from './schema';
import { loadConfig as doLoadConfig } from './loader';
import type { Settings } from './types';

let _config: Settings | null = null;

export async function loadConfig(options?: {
  globalPath?: string;
  projectPath?: string;
}): Promise<void> {
  _config = await doLoadConfig(options);
}

export const config: Readonly<Settings> = new Proxy({} as Settings, {
  get(_, prop) {
    if (_config === null) {
      throw new Error('Config not loaded. Call loadConfig() first.');
    }
    return _config[prop as keyof Settings];
  },
});

export function validateConfig(data: unknown): Settings {
  return settingsSchema.parse(data);
}

export * from './types';
export { ConfigError, ConfigValidationError, ConfigEnvError } from './errors';
```

**验证检查点**:
- [ ] config 对象只读
- [ ] 未加载时访问抛出错误
- [ ] validateConfig 可独立使用

---

### 阶段六：错误处理 (config/errors.ts)

**目标**: 定义配置相关错误类

**文件路径**: `packages/server/src/config/errors.ts`

**关键代码结构**:

```typescript
export class ConfigError extends Error {
  readonly code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class ConfigValidationError extends ConfigError {
  readonly errors: Array<{ path: string; message: string }>;
  
  constructor(errors: Array<{ path: string; message: string }>) {
    super('Configuration validation failed', 'CONFIG.VALIDATION_ERROR');
    this.errors = errors;
    Object.setPrototypeOf(this, ConfigValidationError.prototype);
  }
}

export class ConfigEnvError extends ConfigError {
  readonly variable: string;
  
  constructor(variable: string) {
    super(`Environment variable not found: ${variable}`, 'CONFIG.ENV_ERROR');
    this.variable = variable;
    Object.setPrototypeOf(this, ConfigEnvError.prototype);
  }
}
```

**验证检查点**:
- [ ] 错误类继承正确
- [ ] 包含有用的上下文信息

---

### 阶段七：集成到服务启动

**目标**: 在 server 启动时加载配置

**文件路径**: `packages/server/src/index.ts`

**改造前**:

```typescript
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { sessionRoutes, systemRoutes } from './routes';

const app = new Hono();
// ...
```

**改造后**:

```typescript
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { loadConfig } from './config';
import { sessionRoutes, systemRoutes } from './routes';

await loadConfig();

const app = new Hono();
// ...
```

**验证检查点**:
- [ ] 配置在服务启动前加载
- [ ] 加载失败时服务不启动

---

## 文件结构

```
packages/server/src/config/
├── schema.ts          # zod schema 定义（唯一的默认值来源）
├── types.ts           # TypeScript 类型导出
├── env.ts             # 环境变量替换
├── loader.ts          # 配置加载和合并逻辑
├── errors.ts          # 错误类定义
└── index.ts           # 主入口，导出 config 对象
```

---

## 测试策略

### 单元测试

**文件路径**: `packages/server/src/config/__tests__/loader.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig, deepMerge } from '../loader';

describe('deepMerge', () => {
  it('should merge nested objects', () => {
    const global = { llm: { name: 'global', timeout: 30000 } };
    const local = { llm: { name: 'local' } };
    
    const result = deepMerge(global, local);
    
    expect(result).toEqual({
      llm: { name: 'local', timeout: 30000 },
    });
  });
  
  it('should handle arrays by replacing', () => {
    const global = { models: ['a', 'b'] };
    const local = { models: ['c'] };
    
    const result = deepMerge(global, local);
    
    expect(result).toEqual({ models: ['c'] });
  });
});

describe('loadConfig', () => {
  const testDir = join(process.cwd(), '.test-config');
  
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });
  
  it('should return defaults when no config files exist', async () => {
    const config = await loadConfig({
      globalPath: join(testDir, 'global.json'),
      projectPath: join(testDir, 'project.json'),
    });
    
    expect(config.llm.name).toBe('default');
    expect(config.llm.model).toBe('glm-4.7');
    expect(config.ui.theme).toBe('auto');
  });
  
  it('should merge global and project configs', async () => {
    writeFileSync(
      join(testDir, 'global.json'),
      JSON.stringify({ llm: { name: 'global', timeout: 60000 } })
    );
    writeFileSync(
      join(testDir, 'project.json'),
      JSON.stringify({ llm: { name: 'local' } })
    );
    
    const config = await loadConfig({
      globalPath: join(testDir, 'global.json'),
      projectPath: join(testDir, 'project.json'),
    });
    
    expect(config.llm.name).toBe('local');
    expect(config.llm.timeout).toBe(60000);
  });
});
```

**文件路径**: `packages/server/src/config/__tests__/env.test.ts`

```typescript
import { describe, it, expect } from 'bun:test';
import { replaceEnvVars, deepReplaceEnvVars } from '../env';

describe('replaceEnvVars', () => {
  it('should replace ${VAR} with env value', () => {
    process.env.TEST_VAR = 'test-value';
    expect(replaceEnvVars('${TEST_VAR}')).toBe('test-value');
    delete process.env.TEST_VAR;
  });
  
  it('should use default value when var not found', () => {
    expect(replaceEnvVars('${UNDEFINED_VAR:-default}')).toBe('default');
  });
  
  it('should throw when var not found and no default', () => {
    expect(() => replaceEnvVars('${UNDEFINED_VAR}')).toThrow();
  });
});

describe('deepReplaceEnvVars', () => {
  it('should replace env vars in nested objects', () => {
    process.env.API_KEY = 'secret';
    
    const input = {
      llm: {
        apiKey: '${API_KEY}',
        timeout: 30000,
      },
    };
    
    const result = deepReplaceEnvVars(input) as any;
    
    expect(result.llm.apiKey).toBe('secret');
    expect(result.llm.timeout).toBe(30000);
    
    delete process.env.API_KEY;
  });
});
```

---

## 改造清单

### 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/config/schema.ts` | 新增 | Zod schema 定义 |
| `src/config/types.ts` | 新增 | TypeScript 类型导出 |
| `src/config/env.ts` | 新增 | 环境变量替换 |
| `src/config/loader.ts` | 新增 | 配置加载和合并 |
| `src/config/errors.ts` | 新增 | 错误类定义 |
| `src/config/index.ts` | 新增 | 主入口 |
| `src/index.ts` | 修改 | 添加配置加载 |

### 测试文件

| 文件 | 说明 |
|------|------|
| `src/config/__tests__/loader.test.ts` | 加载器单元测试 |
| `src/config/__tests__/env.test.ts` | 环境变量替换测试 |

---

## 配置示例

### 全局配置 (~/.config/littlething/settings.json)

```json
{
  "llm": {
    "name": "production",
    "messageStyle": "anthropic-messages",
    "apiKey": "${ANTHROPIC_API_KEY}",
    "model": "claude-sonnet-4-6",
    "timeout": 60000,
    "maxRetries": 3
  },
  "ui": {
    "theme": "dark",
    "fontSize": 14
  }
}
```

### 项目局部配置 (./.littlething/settings.json)

```json
{
  "llm": {
    "name": "local-dev",
    "model": "glm-4-flash"
  }
}
```

---

## 注意事项

### 配置加载时机

配置必须在服务启动前加载完成：

```typescript
// 正确
await loadConfig();
const app = new Hono();

// 错误 - 配置未加载
const app = new Hono();
await loadConfig(); // 太晚了
```

### 环境变量敏感信息

不要在配置文件中硬编码敏感信息：

```json
// 错误
{
  "llm": {
    "apiKey": "sk-xxxxx"
  }
}

// 正确
{
  "llm": {
    "apiKey": "${ANTHROPIC_API_KEY}"
  }
}
```

### 配置文件不存在

配置文件不存在时使用默认值，不会报错：

```typescript
// 如果两个配置文件都不存在，返回默认配置
const config = await loadConfig();
console.log(config.llm.model); // 'glm-4.7'
```

---

## 参考资料

- [Zod 文档](https://zod.dev/)
- [规范文档](../spec/settings.md)
- [设计文档](../plans/2026-03-23-settings-config-design.md)

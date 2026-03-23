# Settings 配置系统技术实施文档

## 实施概览

本文档基于 [settings.md](../spec/settings.md) 规范，提供完整的实施指导。

### 实施范围

- 配置 Schema 定义与验证
- 多层级配置加载与合并
- 环境变量替换机制
- 错误处理与日志记录
- 单元测试与集成测试

### 技术栈

- **运行时**: Bun
- **验证库**: Zod v3+
- **文件系统**: Node.js fs/promises
- **路径处理**: Node.js path
- **环境变量**: process.env

---

## 实施步骤

### 阶段一：Schema 定义 (schema.ts)

**目标**: 创建唯一的配置默认值来源

**文件路径**: `packages/server/src/config/schema.ts`

**实施要点**:

1. 使用 Zod 定义嵌套对象结构
2. 所有默认值通过 `.default()` 设置
3. 导出类型推断结果

**关键代码结构**:

```typescript
import { z } from 'zod';

const messageStyleSchema = z.enum([
  'anthropic-messages',
  'openai-completions', 
  'gemini-generateContent'
]).default('anthropic-messages');

const llmSchema = z.object({
  name: z.string().default('default'),
  messageStyle: messageStyleSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().default('glm-4.7'),
  timeout: z.number().min(1000).max(120000).default(30000),
  maxRetries: z.number().min(0).max(5).default(3)
});

const uiSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  fontSize: z.number().min(12).max(24).default(14)
});

export const settingsSchema = z.object({
  llm: llmSchema,
  ui: uiSchema
});

export type Settings = z.infer<typeof settingsSchema>;
```

**验证检查点**:
- [ ] 所有字段都有默认值
- [ ] 数值范围限制正确
- [ ] 枚举值与规范一致
- [ ] TypeScript 类型正确导出

---

### 阶段二：类型定义 (types.ts)

**目标**: 导出公共类型和错误类

**文件路径**: `packages/server/src/config/types.ts`

**实施要点**:

1. 重新导出 Settings 类型
2. 定义配置错误类层次
3. 提供错误代码常量

**关键代码结构**:

```typescript
import { ZodIssue } from 'zod';
import type { Settings } from './schema';

export type { Settings };

export const ConfigErrorCode = {
  VALIDATION_ERROR: 'CONFIG_VALIDATION_ERROR',
  ENV_MISSING: 'CONFIG_ENV_MISSING',
  FILE_READ_ERROR: 'CONFIG_FILE_READ_ERROR',
  PARSE_ERROR: 'CONFIG_PARSE_ERROR'
} as const;

export class ConfigError extends Error {
  constructor(
    message: string,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(
    public errors: ZodIssue[]
  ) {
    super(
      `Configuration validation failed: ${errors.map(e => e.message).join(', ')}`,
      ConfigErrorCode.VALIDATION_ERROR
    );
    this.name = 'ConfigValidationError';
  }
}

export class ConfigEnvError extends ConfigError {
  constructor(
    public variable: string
  ) {
    super(
      `Environment variable '${variable}' is required but not set`,
      ConfigErrorCode.ENV_MISSING
    );
    this.name = 'ConfigEnvError';
  }
}
```

**验证检查点**:
- [ ] 错误类继承关系正确
- [ ] 错误代码常量完整
- [ ] 错误消息清晰有用

---

### 阶段三：环境变量替换 (env.ts)

**目标**: 实现字符串值的环境变量替换

**文件路径**: `packages/server/src/config/env.ts`

**实施要点**:

1. 仅处理字符串值
2. 支持 `${VAR}` 和 `${VAR:-default}` 语法
3. 替换失败时抛出 ConfigEnvError

**关键代码结构**:

```typescript
import { ConfigEnvError } from './types';

const ENV_VAR_PATTERN = /\$\{([^}]+)\}/g;

function parseEnvExpression(expression: string): { name: string; defaultValue?: string } {
  const colonIndex = expression.indexOf(':-');
  
  if (colonIndex === -1) {
    return { name: expression };
  }
  
  return {
    name: expression.substring(0, colonIndex),
    defaultValue: expression.substring(colonIndex + 2)
  };
}

function replaceEnvVar(match: string): string {
  const expression = match.slice(2, -1);
  const { name, defaultValue } = parseEnvExpression(expression);
  const value = process.env[name];
  
  if (value !== undefined) {
    return value;
  }
  
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  
  throw new ConfigEnvError(name);
}

export function replaceEnvVars(value: string): string {
  return value.replace(ENV_VAR_PATTERN, replaceEnvVar);
}

export function deepReplaceEnvVars(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return replaceEnvVars(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(deepReplaceEnvVars);
  }
  
  if (obj !== null && typeof obj === 'object') {
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
- [ ] 正则表达式正确匹配语法
- [ ] 默认值语法正确解析
- [ ] 仅字符串值被替换
- [ ] 错误时抛出正确异常

---

### 阶段四：配置加载器 (loader.ts)

**目标**: 实现多层级配置加载与合并

**文件路径**: `packages/server/src/config/loader.ts`

**实施要点**:

1. 支持全局和局部配置路径
2. 实现深度合并算法
3. 处理文件不存在的情况
4. 按顺序：读取 → 合并 → 替换环境变量 → 验证

**关键代码结构**:

```typescript
import { readFile, access } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { settingsSchema } from './schema';
import { deepReplaceEnvVars } from './env';
import { ConfigError, ConfigValidationError, Settings } from './types';

const DEFAULT_GLOBAL_PATH = join(homedir(), '.config', 'littlething', 'settings.json');
const DEFAULT_PROJECT_PATH = join(process.cwd(), '.littlething', 'settings.json');

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadJsonFile(path: string): Promise<Record<string, unknown> | null> {
  if (!(await fileExists(path))) {
    return null;
  }
  
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigError(
      `Failed to parse config file: ${path}`,
      'CONFIG_PARSE_ERROR',
      error instanceof Error ? error : undefined
    );
  }
}

function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };
  
  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];
    
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
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
  
  const [globalConfig, projectConfig] = await Promise.all([
    loadJsonFile(globalPath),
    loadJsonFile(projectPath)
  ]);
  
  const merged = deepMerge(
    globalConfig ?? {},
    projectConfig ?? {}
  );
  
  const withEnvVars = deepReplaceEnvVars(merged);
  
  const result = settingsSchema.safeParse(withEnvVars);
  
  if (!result.success) {
    throw new ConfigValidationError(result.error.errors);
  }
  
  return result.data;
}
```

**验证检查点**:
- [ ] 文件不存在时正常处理
- [ ] 深度合并逻辑正确
- [ ] 环境变量替换在合并后执行
- [ ] 验证失败时抛出正确错误

---

### 阶段五：主入口 (index.ts)

**目标**: 提供统一的配置访问接口

**文件路径**: `packages/server/src/config/index.ts`

**实施要点**:

1. 导出单例 config 对象
2. 提供 loadConfig 函数
3. 导出所有公共类型

**关键代码结构**:

```typescript
import { loadConfig as load, Settings } from './types';
export { Settings } from './types';
export { loadConfig } from './loader';

let _config: Settings | null = null;

export const config: Settings = new Proxy({} as Settings, {
  get(target, prop) {
    if (!_config) {
      throw new Error(
        'Config not loaded. Call loadConfig() first.'
      );
    }
    return _config[prop as keyof Settings];
  },
  
  set() {
    throw new Error('Config is read-only');
  }
});

export async function initializeConfig(options?: {
  globalPath?: string;
  projectPath?: string;
}): Promise<void> {
  _config = await load(options);
}
```

**验证检查点**:
- [ ] 未加载时访问抛出错误
- [ ] 配置对象只读
- [ ] 类型导出完整

---

## 测试策略

### 单元测试

**文件路径**: `packages/server/src/config/__tests__/`

#### 1. schema.test.ts

```typescript
import { describe, it, expect } from 'bun:test';
import { settingsSchema } from '../schema';

describe('settingsSchema', () => {
  it('should apply default values for empty object', () => {
    const result = settingsSchema.parse({});
    expect(result.llm.name).toBe('default');
    expect(result.llm.model).toBe('glm-4.7');
    expect(result.ui.theme).toBe('auto');
  });
  
  it('should validate messageStyle enum', () => {
    expect(() => settingsSchema.parse({
      llm: { messageStyle: 'invalid' }
    })).toThrow();
  });
  
  it('should validate timeout range', () => {
    expect(() => settingsSchema.parse({
      llm: { timeout: 500 }
    })).toThrow();
    
    expect(() => settingsSchema.parse({
      llm: { timeout: 200000 }
    })).toThrow();
  });
});
```

#### 2. env.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { replaceEnvVars, deepReplaceEnvVars } from '../env';

describe('env replacement', () => {
  beforeEach(() => {
    process.env.TEST_VAR = 'test_value';
  });
  
  afterEach(() => {
    delete process.env.TEST_VAR;
  });
  
  it('should replace ${VAR} syntax', () => {
    expect(replaceEnvVars('${TEST_VAR}')).toBe('test_value');
  });
  
  it('should use default value when var not set', () => {
    expect(replaceEnvVars('${UNDEFINED:-default}')).toBe('default');
  });
  
  it('should throw for missing var without default', () => {
    expect(() => replaceEnvVars('${UNDEFINED}')).toThrow();
  });
  
  it('should deep replace in objects', () => {
    const obj = {
      llm: {
        apiKey: '${TEST_VAR}',
        timeout: 30000
      }
    };
    
    const result = deepReplaceEnvVars(obj) as any;
    expect(result.llm.apiKey).toBe('test_value');
    expect(result.llm.timeout).toBe(30000);
  });
});
```

#### 3. loader.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadConfig } from '../loader';

describe('config loader', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = join(tmpdir(), `config-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });
  
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });
  
  it('should merge global and project configs', async () => {
    const globalPath = join(tempDir, 'global.json');
    const projectPath = join(tempDir, 'project.json');
    
    await writeFile(globalPath, JSON.stringify({
      llm: { name: 'global', timeout: 30000 }
    }));
    
    await writeFile(projectPath, JSON.stringify({
      llm: { name: 'local', model: 'custom-model' }
    }));
    
    const config = await loadConfig({ globalPath, projectPath });
    
    expect(config.llm.name).toBe('local');
    expect(config.llm.timeout).toBe(30000);
    expect(config.llm.model).toBe('custom-model');
  });
  
  it('should use defaults when no config files exist', async () => {
    const config = await loadConfig({
      globalPath: join(tempDir, 'nonexistent.json'),
      projectPath: join(tempDir, 'nonexistent2.json')
    });
    
    expect(config.llm.name).toBe('default');
    expect(config.llm.model).toBe('glm-4.7');
  });
});
```

### 集成测试

**测试场景**:

1. 完整配置加载流程
2. 环境变量替换与验证的组合
3. 错误处理的端到端测试

---

## 集成指南

### 在 Server 启动时集成

**文件**: `packages/server/src/index.ts`

```typescript
import { initializeConfig, config } from './config';

async function main() {
  await initializeConfig();
  
  console.log(`Server starting with LLM: ${config.llm.name}`);
  
  // 其他启动逻辑...
}

main().catch(console.error);
```

### 在其他模块中使用

```typescript
import { config } from './config';

// 直接访问配置值
const model = config.llm.model;
const timeout = config.llm.timeout;

// 在函数中使用
async function callLLM(prompt: string) {
  const response = await fetch(config.llm.baseUrl ?? 'https://api.example.com', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.llm.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.llm.model,
      prompt,
      timeout: config.llm.timeout
    })
  });
  
  return response.json();
}
```

---

## 性能考虑

### 启动时加载

- **优点**: 配置只加载一次，运行时访问零开销
- **缺点**: 配置变更需要重启服务

### 内存占用

- 配置对象通常 < 1KB
- 单例模式避免重复加载

### 文件读取优化

- 使用 `Promise.all` 并行读取全局和局部配置
- 文件不存在时快速失败（不阻塞）

---

## 错误处理最佳实践

### 错误分类

| 错误类型 | 场景 | 处理方式 |
|---------|------|---------|
| ConfigValidationError | Schema 验证失败 | 记录详细错误，退出进程 |
| ConfigEnvError | 环境变量缺失 | 提示用户设置环境变量 |
| ConfigError | 文件读取/解析失败 | 记录错误，使用默认配置 |

### 错误日志示例

```typescript
import { ConfigError, ConfigValidationError, ConfigEnvError } from './config';

try {
  await initializeConfig();
} catch (error) {
  if (error instanceof ConfigValidationError) {
    console.error('Configuration validation failed:');
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  
  if (error instanceof ConfigEnvError) {
    console.error(`Missing required environment variable: ${error.variable}`);
    process.exit(1);
  }
  
  if (error instanceof ConfigError) {
    console.error(`Configuration error: ${error.message}`);
  }
}
```

---

## 部署检查清单

- [ ] 全局配置目录存在: `~/.config/littlething/`
- [ ] 必需的环境变量已设置
- [ ] 配置文件 JSON 格式正确
- [ ] 数值范围符合 Schema 限制
- [ ] 枚举值拼写正确

---

## 维护指南

### 添加新配置项

1. 在 `schema.ts` 中添加字段定义
2. 设置合理的默认值
3. 更新类型导出
4. 添加单元测试
5. 更新文档

### 修改默认值

1. 仅在 `schema.ts` 中修改
2. 运行所有测试确保兼容性
3. 更新变更日志

### 废弃配置项

1. 在 Schema 中标记为 `.optional()`
2. 添加弃用警告日志
3. 在下一个主版本移除

---

## 常见问题

### Q: 配置文件不存在会怎样？

A: 使用 Schema 定义的默认值，服务正常启动。

### Q: 如何验证配置是否正确？

A: 调用 `validateConfig(data)` 进行手动验证。

### Q: 可以在运行时修改配置吗？

A: 不可以，config 对象是只读的。需要修改配置文件并重启服务。

### Q: 环境变量替换失败怎么办？

A: 抛出 `ConfigEnvError`，服务启动失败并提示缺失的环境变量名。

---

## 实施时间线

| 阶段 | 任务 | 预计时间 |
|------|------|---------|
| 1 | Schema 定义 | 1 小时 |
| 2 | 类型定义 | 0.5 小时 |
| 3 | 环境变量替换 | 1 小时 |
| 4 | 配置加载器 | 2 小时 |
| 5 | 主入口 | 0.5 小时 |
| 6 | 单元测试 | 2 小时 |
| 7 | 集成测试 | 1 小时 |
| **总计** | | **8 小时** |

---

## 参考资料

- [Zod 文档](https://zod.dev/)
- [Node.js fs/promises API](https://nodejs.org/api/fs.html#fs_promises_api)
- [规范文档](../spec/settings.md)

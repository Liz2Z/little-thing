# Tools 模块重新设计计划

## 背景

参考 `/Users/lishuang/workDir/pi-mono` 中 tools 的设计，重新设计 `/Users/lishuang/workDir/little-thing/packages/server/src/tools`。

## 当前设计分析

### little-thing 当前设计

**问题：**
1. **类型系统不够完善** - 使用简单的自定义类型，没有使用 TypeBox 进行 schema 验证
2. **缺乏可插拔的操作接口** - 无法支持远程文件系统（如 SSH）
3. **输出截断机制缺失** - 没有统一的输出大小限制处理
4. **参数命名不一致** - 如 `old_str` vs `oldText`，`file_path` vs `path`
5. **缺乏 AbortSignal 支持** - 无法取消正在执行的工具操作
6. **工具创建函数缺失** - 无法针对不同 cwd 创建配置化的工具实例
7. **返回结果结构简单** - 只有 `success`/`output`/`error`，没有详细的元数据

**当前类型定义：**
```typescript
export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}
```

### pi-mono 设计优点

1. **使用 TypeBox 进行参数 schema 定义** - 类型安全且可验证
2. **可插拔的操作接口 (Operations)** - 支持本地和远程文件系统
3. **统一的截断机制** - `truncate.ts` 提供 head/tail/line 截断
4. **支持 AbortSignal** - 可取消的工具执行
5. **工具工厂函数** - `createXxxTool(cwd, options)` 模式
6. **丰富的返回结果** - 包含 content 数组和 details 元数据
7. **路径处理工具** - `path-utils.ts` 处理各种路径场景

## 重新设计方案

### 1. 类型系统重构

**新增文件：`types.ts`**

```typescript
import type { Static, TSchema } from '@sinclair/typebox';

// 内容块类型（文本和图像）
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

// 工具执行结果
export interface ToolExecutionResult<TDetails = any> {
  content: (TextContent | ImageContent)[];
  details?: TDetails;
}

// 工具定义接口（类似 AgentTool）
export interface Tool<TParameters extends TSchema = TSchema, TDetails = any> {
  name: string;
  label: string;
  description: string;
  parameters: TParameters;
  execute: (
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult<TDetails>>;
}

// 截断结果类型
export interface TruncationResult {
  content: string;
  truncated: boolean;
  truncatedBy: 'lines' | 'bytes' | null;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  lastLinePartial: boolean;
  firstLineExceedsLimit: boolean;
  maxLines: number;
  maxBytes: number;
}
```

### 2. 新增共享工具模块

**新增文件：`truncate.ts`**
- 从 pi-mono 移植截断逻辑
- 提供 `truncateHead`, `truncateTail`, `truncateLine` 函数
- 默认限制：2000 行 / 50KB

**新增文件：`path-utils.ts`**
- 从 pi-mono 移植路径处理逻辑
- 支持 `~` 展开、绝对/相对路径解析
- macOS 特殊文件名处理（AM/PM、NFD、curly quote）

**新增文件：`edit-diff.ts`**
- 从 pi-mono 移植 diff 生成逻辑
- 支持 fuzzy matching、BOM 处理、换行符处理

### 3. 各工具重构

#### `ls.ts`

**变化：**
- 使用 TypeBox 定义参数 schema
- 添加 `LsOperations` 接口支持可插拔操作
- 添加 `LsToolDetails` 返回截断信息
- 默认限制 500 个条目
- 按字母排序，目录加 `/` 后缀

**参数变化：**
```typescript
// 旧
{ path: string }

// 新
{
  path?: string;      // 可选，默认当前目录
  limit?: number;     // 可选，默认 500
}
```

#### `read.ts`

**变化：**
- 使用 TypeBox 定义参数 schema
- 添加 `ReadOperations` 接口
- 支持图像文件读取（返回 ImageContent）
- 添加 `ReadToolDetails` 返回截断信息
- offset 改为 1-indexed
- 默认限制 2000 行 / 50KB

**参数变化：**
```typescript
// 旧
{
  file_path: string;
  offset?: number;    // 0-indexed
  limit?: number;
}

// 新
{
  path: string;       // 改为 path
  offset?: number;    // 1-indexed
  limit?: number;
}
```

#### `write.ts`

**变化：**
- 使用 TypeBox 定义参数 schema
- 添加 `WriteOperations` 接口
- 自动创建父目录

**参数变化：**
```typescript
// 旧
{
  file_path: string;
  content: string;
}

// 新
{
  path: string;       // 改为 path
  content: string;
}
```

#### `edit.ts`

**变化：**
- 使用 TypeBox 定义参数 schema
- 添加 `EditOperations` 接口
- 添加 fuzzy matching 支持
- 处理 BOM 和换行符
- 返回 diff 信息

**参数变化：**
```typescript
// 旧
{
  file_path: string;
  old_str: string;
  new_str: string;
}

// 新
{
  path: string;       // 改为 path
  oldText: string;    // 改为 camelCase
  newText: string;    // 改为 camelCase
}
```

#### `grep.ts`

**变化：**
- 使用 TypeBox 定义参数 schema
- 添加 `GrepOperations` 接口
- 使用 ripgrep (rg) 替代手动遍历
- 支持 JSON 输出解析
- 添加 `GrepToolDetails` 返回截断信息
- 默认限制 100 个匹配

**参数变化：**
```typescript
// 旧
{
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'files_with_matches' | 'content' | 'count';
  '-i'?: boolean;
  '-n'?: boolean;
  '-C'?: number;
}

// 新
{
  pattern: string;
  path?: string;           // 搜索路径
  glob?: string;           // glob 过滤
  ignoreCase?: boolean;    // 改为 camelCase，替代 -i
  literal?: boolean;       // 新增：是否作为字面量
  context?: number;        // 改为 camelCase，替代 -C
  limit?: number;          // 新增：匹配数量限制，默认 100
}
```

### 4. Index 文件重构

**新增文件：`index.ts`**

```typescript
// 导出所有工具创建函数和默认实例
export {
  createLsTool,
  lsTool,
  type LsOperations,
  type LsToolDetails,
  type LsToolInput,
} from './ls.js';
// ... 其他工具

// 工具集合
export const codingTools: Tool[] = [readTool, editTool, writeTool];
export const readOnlyTools: Tool[] = [readTool, grepTool, lsTool];
export const allTools = { read: readTool, write: writeTool, edit: editTool, grep: grepTool, ls: lsTool };

// 工厂函数
export function createCodingTools(cwd: string): Tool[] { ... }
export function createReadOnlyTools(cwd: string): Tool[] { ... }
export function createAllTools(cwd: string): Record<string, Tool> { ... }
```

### 5. 测试文件更新

所有测试文件需要更新以适配新的：
- 参数命名（camelCase）
- 返回结果结构（content 数组 + details）
- 新的工具创建方式

## 依赖变更

**新增依赖：**
```json
{
  "@sinclair/typebox": "^0.x.x"
}
```

## 实施步骤

1. **创建共享模块**
   - 创建 `truncate.ts`
   - 创建 `path-utils.ts`
   - 创建 `edit-diff.ts`

2. **更新类型定义**
   - 重写 `types.ts`

3. **重构各工具**
   - 重构 `ls.ts`
   - 重构 `read.ts`
   - 重构 `write.ts`
   - 重构 `edit.ts`
   - 重构 `grep.ts`

4. **更新入口文件**
   - 重写 `index.ts`

5. **更新测试**
   - 更新 `ls.test.ts`
   - 更新 `read.test.ts`
   - 更新 `write.test.ts`
   - 更新 `edit.test.ts`
   - 更新 `grep.test.ts`

6. **验证**
   - 运行所有测试
   - 检查类型正确性

## 兼容性说明

这是一个**破坏性变更**，主要影响：
1. 参数命名从 snake_case 改为 camelCase
2. 返回结果从 `{success, output, error}` 改为 `{content, details}`
3. 需要使用工具创建函数传入 cwd

调用方需要相应更新。

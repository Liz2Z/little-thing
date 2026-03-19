# 测试规范文档

## 📁 测试目录结构

所有测试文件统一放在 `__tests__/` 目录下，与源代码分离：

```
packages/
├── server/
│   ├── src/          # 源代码
│   └── __tests__/
│       ├── tools/    # 工具测试
│       ├── routes/   # 路由测试
│       └── storage/  # 存储测试
├── web/
│   ├── src/          # 源代码
│   └── __tests__/
│       ├── components/  # 组件测试
│       ├── hooks/       # Hooks 测试
│       └── store/       # Store 测试
├── cli/
│   ├── src/          # 源代码
│   └── __tests__/
│       ├── commands/    # 命令测试
│       └── integration/ # 集成测试
└── e2e/              # E2E 测试（根目录）
    ├── sessions/
    └── chat/
```

## 🎯 TDD 工作流程

### 红-绿-重构循环

1. **红**：编写失败的测试
   - 为新功能编写测试用例
   - 运行测试，确认失败

2. **绿**：让测试通过
   - 编写最少量的代码让测试通过
   - 运行测试，确认通过

3. **重构**：改进代码
   - 在测试保护下重构代码
   - 确保测试依然通过

### 测试命令

```bash
# 运行所有测试（Turbo 加速）
bun test

# 运行特定包的测试
bun test --filter=@littlething/server
cd packages/server && bun test

# 监听模式（开发时使用）
bun test:watch --filter=@littlething/server

# 生成覆盖率报告
bun test:coverage

# CI 环境（无缓存）
bun test:ci
```

## 📝 测试命名规范

### 文件命名

- 单元测试：`*.test.ts` 或 `*.test.tsx`
- 集成测试：`*.integration.test.ts`
- E2E 测试：`*.spec.ts`

### 测试用例命名

使用 `describe` 和 `it` 清晰描述测试内容：

```typescript
describe('ComponentName', () => {
  describe('when user clicks button', () => {
    it('should show modal', () => {
      // 测试代码
    });
  });

  describe('when data is loading', () => {
    it('should show spinner', () => {
      // 测试代码
    });
  });
});
```

## 🔧 各包测试指南

### Server 包测试

**技术栈**：Bun 内置测试框架

```bash
cd packages/server
bun test
```

**测试类型**：
- 单元测试：工具函数、存储模块
- 集成测试：API endpoints

**示例**：
```typescript
import { describe, it, expect } from 'bun:test';

describe('tool function', () => {
  it('should return correct result', () => {
    const result = toolFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Web 包测试

**技术栈**：Vitest + @testing-library/react

```bash
cd packages/web
bun test  # 或 vitest
```

**测试类型**：
- 组件测试：渲染、交互、状态
- Hooks 测试：自定义 hooks 行为
- Store 测试：Zustand 状态管理

**组件测试示例**：
```typescript
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('should render correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(<Button onClick={handleClick}>Click me</Button>);
    await user.click(screen.getByText('Click me'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

**Hooks 测试示例**：
```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from '@/hooks/useCounter';

describe('useCounter', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

### CLI 包测试

**技术栈**：Bun 内置测试框架

```bash
cd packages/cli
bun test
```

**测试类型**：
- 命令测试：CLI 命令解析和执行
- 集成测试：完整工作流测试

### E2E 测试

**技术栈**：Playwright

```bash
# 在根目录运行
bunx playwright test
```

**测试类型**：端到端用户流程

```typescript
import { test, expect } from '@playwright/test';

test('user can create a new session', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('text=New Session');
  await page.fill('input[name="name"]', 'Test Session');
  await page.click('button[type="submit"]');

  await expect(page.locator('text=Test Session')).toBeVisible();
});
```

## 🚀 Turbo 使用指南

Turbo 通过缓存加速测试执行：

### Turbo 任务

- `test`：运行测试，使用缓存
- `test:coverage`：生成覆盖率报告，使用缓存
- `test:watch`：监听模式，不使用缓存
- `test:ci`：CI 环境，不使用缓存

### 智能过滤

```bash
# 仅运行变更包的测试
turbo run test --filter=[HEAD]

# 运行特定包及其依赖的测试
turbo run test --filter=@littlething/web
```

## 🛠️ 测试辅助工具

### Fixtures

通用测试 fixtures 位于各包的 `__tests__/fixtures/`：

```typescript
// __tests__/fixtures/sessions.ts
export function createMockSession(overrides = {}) {
  return {
    id: 'test-session-id',
    name: 'Test Session',
    messages: [],
    createdAt: Date.now(),
    ...overrides,
  };
}
```

### Mock 工具

```typescript
// Mock SDK
import { vi } from 'vitest';
vi.mock('@littlething/sdk', () => ({
  createClient: vi.fn(() => ({
    sessions: {
      list: vi.fn(),
      create: vi.fn(),
    },
  })),
}));
```

## 📊 覆盖率目标

- 整体覆盖率目标：**80%**
- 核心功能（会话、消息）：**90%**
- UI 组件：**70%**

查看覆盖率报告：
```bash
bun test:coverage
open coverage/index.html
```

## ✅ 测试最佳实践

### 1. 保持测试简单

- 每个测试只测试一个行为
- 使用 `describe` 组织相关测试
- 避免过度 mock

### 2. 测试用户行为

```typescript
// ❌ 测试实现细节
it('should set isOpen state to true', () => {
  // ...
});

// ✅ 测试用户行为
it('should show modal when button is clicked', () => {
  // ...
});
```

### 3. 使用 page object 模式（E2E）

```typescript
class SessionPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/sessions');
  }

  async createSession(name: string) {
    await this.page.click('text=New Session');
    await this.page.fill('input[name="name"]', name);
    await this.page.click('button[type="submit"]');
  }
}
```

### 4. 清理副作用

```typescript
import { beforeEach, afterEach } from 'bun:test';

describe('test suite', () => {
  beforeEach(async () => {
    // 设置
  });

  afterEach(async () => {
    // 清理
  });
});
```

## 🔍 调试测试

### Vitest 调试

```bash
# UI 模式
bun test --ui

# 调试特定测试
bun test --grep "should show modal"

# 查看详细输出
bun test --reporter=verbose
```

### Playwright 调试

```bash
# 显示浏览器
bunx playwright test --headed

# 调试模式
bunx playwright test --debug

# 慢动作模式
bunx playwright test --slow-mo=1000
```

## 📚 参考资源

- [Bun Testing](https://bun.sh/docs/test)
- [Vitest](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright](https://playwright.dev/)
- [Turbo](https://turbo.build/repo/docs)

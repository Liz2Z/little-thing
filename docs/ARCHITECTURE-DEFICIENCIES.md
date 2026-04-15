# 架构缺陷分析

本文档记录了 little-thing 项目当前架构中发现的缺陷和需要改进的地方。

## 1. 模块依赖违反设计原则

### 1.1 Agent 依赖 Session 模块

**问题描述**：
- `agent/agent.ts` 导入了 `session/convert.ts` 中的 `toCoreMessages` 函数
- `agent/agent.ts` 导入了 `session/message.ts` 中的类型定义
- 违反了开发规范："agent/ 不能依赖任何 session/ 中的模块"

**位置**：
- `packages/thing/src/agent/agent.ts:3-4`

**影响**：
- 破坏了模块的单向依赖原则
- 增加了 agent 模块的耦合度
- 降低了 agent 模块的复用性

**建议修复**：
- 将 `Message` 类型和 `toCoreMessages` 转换函数移至公共的 `lib/` 或独立的 `types/` 模块
- 或者在 agent 模块内定义自己的消息类型，由调用方（如 AIService）负责转换

## 2. 配置管理违反 XDG 规范

### 2.1 直接使用 homedir() 而非 xdg-basedir

**问题描述**：
- `settings/core.ts` 导入并使用了 `homedir()` 作为回退方案
- 违反了开发规范："不要直接使用 homedir() 来获取用户目录，而要使用 xdg-basedir 库来获取"

**位置**：
- `packages/thing/src/settings/core.ts:8`
- `packages/thing/src/settings/core.ts:181`
- `packages/thing/src/tools/path-utils.ts:40,43`

**影响**：
- 不符合 XDG Base Directory 规范
- 可能导致配置文件位置不统一

**建议修复**：
- 完全移除 `homedir()` 的使用
- 如果 `xdgConfig` 为 null，应该抛出错误或使用 xdg-basedir 提供的其他 API

## 3. 缺失的 SSE 事件系统实现

### 3.1 架构文档与实现不匹配

**问题描述**：
- `ARCHITECTURE.md` 详细描述了 SSE 事件系统的架构设计
- 文档中提到了 `events/sse.ts` 文件，但该文件不存在
- 文档描述的全局 SSE 端点 `GET /events?sessionId=xxx` 未找到实现
- 当前只在 session 路由中使用了 `streamSSE` 进行流式响应

**位置**：
- 文档：`docs/ARCHITECTURE.md:61-103`
- 缺失文件：`packages/thing/src/events/sse.ts`

**影响**：
- 文档与实际实现脱节
- Web 客户端可能无法通过全局 SSE 连接接收实时事件
- 事件总线（EventBus）目前未被充分利用

**建议修复**：
- 实现全局 SSE 端点和 SSE Manager
- 或者更新文档以反映当前的流式响应架构
- 明确事件系统的实际架构和使用方式

## 4. Web 前端状态管理混乱

### 4.1 store 和 stores 目录重复

**问题描述**：
- `packages/web/src/` 下同时存在 `store/` 和 `stores/` 两个目录
- `store/` 包含 `sessionStore.ts` 和 `configStore.ts`
- `stores/` 包含 `eventStore.ts`
- 命名不一致，容易混淆

**位置**：
- `packages/web/src/store/`
- `packages/web/src/stores/`

**影响**：
- 降低代码可维护性
- 新开发者容易困惑
- 违反了代码组织的一致性原则

**建议修复**：
- 统一使用 `stores/` 目录（复数形式更符合惯例）
- 将所有 store 文件移至同一目录

## 5. 包结构与文档不一致

### 5.1 实际包结构与文档描述不符

**问题描述**：
- `ARCHITECTURE.md` 描述了 `packages/server/` 和 `packages/cli/` 两个独立包
- 实际实现中，这两个包已合并为 `packages/thing/`
- 文档未同步更新

**位置**：
- 文档：`docs/ARCHITECTURE.md:36-43, 180-233`
- 实际：`packages/thing/`

**影响**：
- 新开发者或贡献者会被误导
- 文档失去参考价值

**建议修复**：
- 更新 `ARCHITECTURE.md` 以反映当前的包结构
- 确保 Monorepo 结构部分准确描述 `packages/thing/` 的职责

## 6. 缺少类型安全边界

### 6.1 SessionStore 使用 process.cwd()

**问题描述**：
- `routes/session.ts` 中创建 `sessionService` 时直接传入 `process.cwd()`
- SessionStore 应该通过配置系统获取数据目录，而非依赖运行时工作目录

**位置**：
- `packages/thing/src/routes/session.ts:40`

**影响**：
- 数据存储位置不可预测
- 违反了 XDG 规范
- 单元测试困难

**建议修复**：
- 从 settings 获取数据目录路径
- 或者在 SessionStore 初始化时使用 xdg-basedir 获取数据目录

## 7. 错误处理不完整

### 7.1 某些场景下直接返回内部错误

**问题描述**：
- 虽然定义了完整的错误类体系，但在某些异常场景下（如 agent.ts 的 catch 块）
- 直接构造 `AgentErrorEvent` 并使用 `"unknown"` 作为错误类型
- 没有充分利用自定义错误类

**位置**：
- `packages/thing/src/agent/agent.ts:285-291`
- `packages/thing/src/session/service.ts:128-140`

**影响**：
- 错误信息不够精确
- 难以进行错误分类和处理

**建议修复**：
- 根据错误类型抛出具体的错误类
- 在 catch 块中进行错误类型判断和转换

## 8. 测试覆盖不足

### 8.1 缺少集成测试

**问题描述**：
- 主要是单元测试和少量 E2E 测试
- 缺少模块间集成测试，特别是：
  - Agent + Session + Tools 的集成测试
  - Event Bus + SSE 的集成测试（如果实现了 SSE）

**影响**：
- 模块间交互的 bug 难以发现
- 重构时缺乏信心

**建议改进**：
- 添加关键路径的集成测试
- 使用测试工具模拟真实场景

## 9. 配置系统过于复杂

### 9.1 Settings 类实现复杂度高

**问题描述**：
- `settings/core.ts` 实现了一个包含 Proxy 的复杂 Accessor 系统
- 支持嵌套访问、监听、CLI 参数解析等多种功能
- 代码行数 357 行，对于配置管理来说过于复杂

**位置**：
- `packages/thing/src/settings/core.ts`

**影响**：
- 增加维护成本
- 可能存在未发现的边界情况
- 新开发者学习成本高

**建议改进**：
- 考虑使用成熟的配置管理库（如 `conf` 或 `cosmiconfig`）
- 或者简化实现，移除不常用的功能
- 拆分为多个小模块

## 10. AI Provider 抽象不足

### 10.1 Provider 工厂直接返回 ai SDK 的 model

**问题描述**：
- `providers/factory.ts` 直接使用 ai SDK 创建 model 并返回
- 没有统一的 Provider 接口抽象
- 如果需要添加自定义 Provider 或 mock，需要修改核心代码

**位置**：
- `packages/thing/src/providers/factory.ts`

**影响**：
- 扩展性差
- 测试时难以 mock LLM 调用
- 与 ai SDK 强耦合

**建议改进**：
- 定义统一的 Provider 接口
- 使用适配器模式包装 ai SDK 的 model
- 便于未来支持其他 LLM 框架或自定义实现

## 总结

主要问题类别：

1. **架构违规**（严重）：Agent 依赖 Session 模块
2. **文档不一致**（严重）：SSE 系统、包结构描述与实际不符
3. **规范违反**（中等）：直接使用 homedir()、store 目录混乱
4. **设计缺陷**（中等）：缺少 Provider 抽象、配置系统过于复杂
5. **代码质量**（轻微）：错误处理不完整、测试覆盖不足

## 优先级建议

**高优先级**：
1. 修复 Agent 对 Session 的依赖（架构违规）
2. 更新或实现 SSE 事件系统（文档与代码一致）
3. 修复 homedir() 违规使用

**中优先级**：
4. 统一 Web store 目录结构
5. 修复 SessionStore 的路径获取方式
6. 更新架构文档以反映实际包结构

**低优先级**：
7. 简化配置系统或使用成熟库
8. 增加 Provider 抽象层
9. 改进错误处理
10. 增加集成测试覆盖

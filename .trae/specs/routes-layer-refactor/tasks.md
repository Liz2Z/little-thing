# Tasks

- [x] Task 1: 创建 session 模块业务逻辑
  - [x] SubTask 1.1: 创建 `session/index.ts`，包含会话相关的业务逻辑和 Schema

- [x] Task 2: 创建路由文件
  - [x] SubTask 2.1: 创建 `routes/session.ts`，会话 + Agent 路由定义
  - [x] SubTask 2.2: 创建 `routes/system.ts`，系统路由定义（逻辑简单，直接处理）
  - [x] SubTask 2.3: 创建 `routes/index.ts`，合并所有路由

- [x] Task 3: 重构入口文件
  - [x] SubTask 3.1: 重构 `routes.ts` 为入口文件，只负责创建 app 和注册各模块路由

- [x] Task 4: 验证和清理
  - [x] SubTask 4.1: 运行类型检查确保无错误
  - [x] SubTask 4.2: 验证所有 API 端点正常工作

# Task Dependencies
- [Task 2] depends on [Task 1] - 路由文件需要模块业务逻辑
- [Task 3] depends on [Task 2] - 入口文件需要所有路由
- [Task 4] depends on [Task 3] - 验证需要完整重构

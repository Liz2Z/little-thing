## 基本约定

- 必须使用 **bun** 替代 **node** 和 **npm**
- 功能多了优先分模块而不是单文件
- 优先内聚而不是扔到通用模块，没有被多次引用的就避免过早抽为通用模块
- 优先具名导出，避免默认导出
- packages/sdk/src 中的代码是自动生成的，不可以手动修改
- do not repeat yourself
- 组合优于继承
- 修改bug后，让用户自己重启服务并测试
- 优先使用 zod，而不是 interface
- 可预期的业务错误不应该叫 internal error, internal error 仅限于不该发生的事发生了（bug、崩溃、意外的异常）
- 不允许直接 throw Error，必须定义具体错误类并抛出。错误按照就近原则定义到使用它的文件中，error code 按照 `模块:错误简介` 的格式（如 `PROVIDER:MISSING_API_KEY`），继承自 `errors/base.ts` 中的基础错误类（AppError/NotFoundError/ValidationError/InternalError 等）
- 不允许为了减少工作量，而修改基础规则，e.g.(biome.json)

## server 规范

- 不**要直接使**用 homedir() 来获取用户目录，而要使用 xdg-basedir 库来获取
- 错误处理不能直接 throw Error，而要 throw 自定义错误类，参考 packages/server/src/errors/index.ts
- 优先 'hono' 搭配 'hono-openapi' 构建 API 服务
- 绝对不要手动修改 @littlething/sdk 中的代码
- SSE 用于实时事件推送，全局唯一，为公共服务，绝对不要为了某个需求修改

## web 规范

- 使用 lucide react，不允许自己写 svg，不允许使用 emoji

## 代码规范

- **UI 开发时必读**: file://./docs/UI-DESIGN.md
- **处理前端、tsx、react逻辑时必读！！！**: file://./docs/DEV-GUIDELINES-FRONTEND.md
- **处理后端逻辑时必读**: file://./docs/DEV-GUIDELINES-BACKEND.md
- **Git 操作必读**: file://./docs/GIT-GUIDELINES.md

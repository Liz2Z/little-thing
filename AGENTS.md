## 基本信息

- 必须使用 **bun** 替代 **node** 和 **npm**
- 功能多了优先分模块而不是单文件
- 优先内聚而不是扔到通用模块，没有被多次引用的就避免过早抽为通用模块
- 优先具名导出，避免默认导出
- packages/sdk/src 中的代码是自动生成的，不可以手动修改
- do not repeat yourself
- 组合优于继承
- 修改bug后，让用户自己重启服务并测试

## server 代码规范

- 不要直接使用 homedir() 来获取用户目录，而要使用 xdg-basedir 库来获取
- 错误处理不能直接 throw Error，而要 throw 自定义错误类，参考 packages/server/src/errors/index.ts

## 代码规范

- **UI 开发时必读**: file://./docs/UI-DESIGN.md
- **处理前端、tsx、react逻辑时必读！！！**: file://./docs/DEV-GUIDELINES-FRONTEND.md
- **处理后端逻辑时必读**: file://./docs/DEV-GUIDELINES-BACKEND.md
- **Git 操作必读**: file://./docs/GIT-GUIDELINES.md

## 基本信息
- 必须使用 **bun** 替代 **node** 和 **npm**
- 功能多了优先分模块而不是单文件
- 优先内聚而不是扔到通用模块，没有被多次引用的就避免过早抽为通用模块
- 优先具名导出，避免默认导出
- packages/sdk/src 中的代码是自动生成的，不可以手动修改
- do not repeat yourself
- 组合优于继承

## 代码规范
- **UI 开发时必读**: file://./docs/UI-DESIGN.md
- **处理前端、tsx、react逻辑时必读！！！**: file://./docs/DEV-GUIDELINES-FRONTEND.md
- **处理后端逻辑时必读**: file://./docs/DEV-GUIDELINES-BACKEND.md  
- **Git 操作必读**: file://./docs/GIT-GUIDELINES.md

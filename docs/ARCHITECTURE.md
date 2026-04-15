这是一个 agent 工具，以 cli 形式提供， 拥有 tui 界面，启动命令：thing。

几个可以想到的 features:

1. cli 支持 `thing server` 来启动一个 hono server，将能力通过 http restful API 暴露出来，可以通过 web 访问。
2. 作为一个 agent 工具，我希望提供对接多种 provider 的能力，通过 ai sdk 来对接各个provider，以对项目提供统一的 API，方便数据处理。
3. 支持多 sessions 和持久化能力，在 agent 关闭后，可以重新打开恢复之前的对话。

重点说说 agent 的能力：

1. 支持多层 prompts ，可以针对不同的 provider / models 设置不同的系统 prompts
2. 支持读取 AGENTS.md
3. 支持工具调用和 skils
4. 支持流式输出以满足 UI 层个性化渲染
5. 支持用户终止 Agent 流程
6. 以 ReAct 模型跑 Agent
7. 支持死循环检测
8. 工具调用支持权限控制
9. 支持 SubAgent

关于 agent 的实现细节：
1. 仅使用 ai sdk 来磨平不同 provider 的响应差异。循环要自主控制：默认无限循环，可中断、工具调用与权限控制、死循环检查、终止机制、状态管理、步骤完成回调等等。
2. 支持针对不同模型预设不同的系统 prompts。
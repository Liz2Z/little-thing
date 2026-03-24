# IM 集成产品需求文档（PRD）

**文档编号**: PRD-2025-001
**版本**: v1.0
**创建日期**: 2025-03-22
**产品**: little-thing
**负责人**: 待定
**状态**: Draft

---

## 文档修订历史

| 版本 | 日期 | 修订人 | 修订内容 |
|------|------|--------|----------|
| v1.0 | 2025-03-22 | - | 初始版本 |

---

## 1. 产品概述

### 1.1 产品背景

little-thing 是一个基于 LLM 的智能助手平台，目前支持 CLI 和 Web 两种交互方式。为了满足企业用户的需求，需要将 Agent 能力扩展到企业 IM 平台（飞书、Slack），让用户可以在日常沟通中直接使用 AI 助手。

### 1.2 产品目标

**核心目标**: 为 little-thing 平台添加飞书和 Slack 机器人能力，实现企业 IM 平台与 Agent 的无缝集成。

**具体目标**:
1. 支持用户通过飞书/Slack 与 Agent 进行对话
2. 自动将 IM 消息转发到 Agent 处理并返回结果
3. 保存完整的消息历史记录
4. 支持多个聊天/频道同时接入
5. 提供稳定可靠的长连接服务

### 1.3 目标用户

**主要用户**:
- 企业员工：在日常工作中使用 AI 助手提高效率
- 开发者：需要调试和监控机器人运行状态

**次要用户**:
- 管理员：配置和管理机器人接入

---

## 2. 需求范围

### 2.1 功能范围

#### 包含的功能

**飞书集成** (Phase 1):
- ✅ WebSocket 长连接接收消息
- ✅ 私聊消息处理
- ✅ 群聊 @ 机器人消息处理
- ✅ 文本消息发送和接收
- ✅ 调用 Agent 处理消息
- ✅ 消息历史持久化
- ✅ 会话映射管理

**Slack 集成** (Phase 2):
- ✅ Socket Mode 接收消息
- ✅ DM 消息处理
- ✅ 频道 @ 机器人消息处理
- ✅ 文本消息发送和接收
- ✅ 调用 Agent 处理消息
- ✅ 消息历史持久化
- ✅ 会话映射管理

**共享功能**:
- ✅ 独立的 integrations 服务进程
- ✅ 通过 HTTP API 调用 Agent
- ✅ 统一的日志和错误处理
- ✅ 健康检查和监控

#### 不包含的功能

**当前版本不考虑**:
- ❌ 富文本消息（卡片、按钮交互）
- ❌ 文件上传和下载
- ❌ 消息编辑和删除
- ❌ 权限管理和用户验证
- ❌ 高可用和多实例部署
- ❌ 消息加密存储
- ❌ 管理后台和监控面板

**后续版本可能考虑**:
- 🔄 消息卡片和交互组件
- 🔄 文件处理
- 🔄 多实例负载均衡
- 🔄 Webhook 模式支持

### 2.2 非功能性需求

#### 性能要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 消息响应时间 | < 3 秒 | 从接收到返回 Agent 响应 |
| Agent 调用延迟 | < 500ms | 发起 Agent API 调用的网络延迟 |
| 并发处理能力 | 10+ 会话 | 同时处理多个聊天/频道的消息 |
| 消息吞吐量 | 100 msg/min | 单个会话的消息处理能力 |

#### 可靠性要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 服务可用性 | 99% | 允许每月约 7.2 小时的停机 |
| 消息丢失率 | < 0.1% | 极少数情况下消息可能丢失 |
| 自动重连 | 支持 | 网络断开后自动重连 |
| 错误恢复 | 支持 | Agent 调用失败后返回友好提示 |

#### 可扩展性要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 平台扩展 | 易扩展 | 添加新平台（如 Discord）需要 < 1 天 |
| 功能扩展 | 中等 | 添加新功能（如卡片消息）需要 < 3 天 |
| 部署扩展 | 灵活 | 支持独立部署或集成部署 |

#### 安全性要求

| 指标 | 要求 | 说明 |
|------|------|------|
| 凭证安全 | 环境变量 | API Key、Secret 不硬编码 |
| 传输安全 | TLS | WebSocket 和 HTTP 使用加密传输 |
| 数据隐私 | 不保存敏感信息 | 不保存用户的私密数据 |
| 访问控制 | 最小权限 | 仅授予必要的 API 权限 |

---

## 3. 产品方案

### 3.1 技术架构

#### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         部署架构                                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  Feishu App      │         │   Slack App      │
│  (飞书服务器)     │         │  (Slack 服务器)   │
└────────┬─────────┘         └────────┬─────────┘
         │                            │
         │ WebSocket (wss://)         │ WebSocket (wss://)
         │                            │
┌────────▼─────────┐         ┌────────▼─────────┐
│  Integrations    │         │                  │
│  Service         │         │                  │
│  (独立进程)       │         │                  │
│                  │         │                  │
│  ┌────────────┐  │         │  ┌────────────┐  │
│  │   Feishu   │  │         │  │   Slack    │  │
│  │   Client   │  │         │  │   Client   │  │
│  └────────────┘  │         │  └────────────┘  │
│                  │         │                  │
│  ┌────────────┐  │         │  ┌────────────┐  │
│  │  Message   │  │         │  │  Message   │  │
│  │  Handlers  │  │         │  │  Handlers  │  │
│  └────────────┘  │         │  └────────────┘  │
│                  │         │                  │
│  ┌────────────┐  │         │  ┌────────────┐  │
│  │   HTTP     │  │         │  │   HTTP     │  │
│  │   Client   │  │         │  │   Client   │  │
│  └─────┬──────┘  │         │  └─────┬──────┘  │
└────────┼─────────┘         └────────┼─────────┘
         │                            │
         │ HTTP POST                  │ HTTP POST
         │ /sessions/{id}/chat        │ /sessions/{id}/chat
         │                            │
┌────────▼────────────────────────────▼─────────────────────────┐
│                         Server                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐              │
│  │   Session  │  │   Agent    │  │    Tool    │              │
│  │   Routes   │  │   Core     │  │   System   │              │
│  └────────────┘  └────────────┘  └────────────┘              │
└───────────────────────────────────────────────────────────────┘
```

#### 组件说明

**Integrations Service** (新增)
- 职责：维护与 IM 平台的 WebSocket 连接，处理消息
- 部署：独立进程，独立包 `packages/integrations`
- 依赖：飞书/Slack SDK，HTTP 客户端

**Server** (现有)
- 职责：提供 Agent 处理能力，管理会话和消息
- 部署：现有服务，无需修改
- 变更：无（复用现有 API）

**Storage**
- 职责：保存会话映射和消息历史
- 实现：基于 JSONL 文件存储
- 位置：`~/.local/share/littlething/integrations/`

### 3.2 技术选型

#### 飞书集成

| 选型 | 方案 | 理由 |
|------|------|------|
| SDK | `@larksuiteoapi/node-sdk` | 官方维护，功能完整，类型支持好 |
| 连接方式 | WebSocket 长连接 | 无需公网 IP，本地开发友好 |
| 消息格式 | 文本消息 | 简单可靠，满足基础需求 |

#### Slack 集成

| 选型 | 方案 | 理由 |
|------|------|------|
| SDK | `@slack/bolt` | 官方框架，Socket Mode 支持 |
| 连接方式 | Socket Mode | 无需公网 IP，开发体验好 |
| 消息格式 | 文本消息 | 简单可靠，满足基础需求 |

### 3.3 数据模型

#### 会话映射 (IntegrationMapping)

```typescript
interface IntegrationMapping {
  id: string;                    // 唯一标识
  platform: 'feishu' | 'slack';  // 平台类型
  platformChatId: string;        // 平台会话 ID
  sessionId: string;             // Agent 会话 ID
  metadata: {
    name?: string;               // 会话名称
    type?: 'private' | 'group' | 'channel';  // 会话类型
    createdAt: string;           // 创建时间
    lastActiveAt: string;        // 最后活跃时间
    messageCount: number;        // 消息计数
  };
  status: 'active' | 'archived' | 'disabled';
}
```

#### 平台消息 (PlatformMessage)

```typescript
interface PlatformMessage {
  id: string;
  platform: 'feishu' | 'slack';
  mappingId: string;
  platformMessageId: string;
  direction: 'incoming' | 'outgoing';
  content: {
    type: 'text' | 'post' | 'card';
    text?: string;
    raw: unknown;
  };
  sender: {
    id: string;
    name?: string;
    type: 'user' | 'bot';
  };
  timestamp: string;
  processing: {
    processed: boolean;
    duration?: number;
    error?: string;
  };
  agentResponse?: {
    sessionId: string;
    content: string;
    toolCalls?: ToolCall[];
  };
}
```

### 3.4 核心流程

#### 消息处理流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant IM as 飞书/Slack
    participant IS as Integrations
    participant Agent as Agent Service

    User->>IM: 发送消息
    IM->>IS: WebSocket 推送消息
    IS->>IS: 解析消息内容
    IS->>IS: 获取/创建会话映射
    IS->>IS: 保存传入消息
    IS->>Agent: HTTP POST /chat (SSE)
    Agent-->>IS: 流式返回事件
    IS->>IS: 处理 Agent 事件
    IS->>IM: 发送回复消息
    IS->>IS: 保存传出消息
    IM->>User: 显示回复
```

#### 错误处理流程

```mermaid
sequenceDiagram
    participant IS as Integrations
    participant Agent as Agent Service
    participant IM as 飞书/Slack

    IS->>Agent: 调用 Agent API
    Agent-->>IS: 返回错误

    alt 网络错误
        IS->>IS: 记录日志，等待重试
    else Agent 错误
        IS->>IM: 发送友好错误提示
        IS->>IS: 保存错误信息
    end
```

---

## 4. 用户体验设计

### 4.1 飞书用户体验

#### 私聊场景

**用户操作流程**:
1. 在飞书中找到机器人
2. 发送消息："帮我查一下北京天气"
3. 机器人回复："北京今天晴天，温度 15-25°C"

**预期体验**:
- 响应时间：2-3 秒
- 消息格式：纯文本
- 错误提示：友好的中文提示

#### 群聊场景

**用户操作流程**:
1. 在群聊中 @ 机器人
2. 发送消息："@机器人 帮我总结这段对话"
3. 机器人群聊回复：总结内容

**预期体验**:
- 必须有 @ 机器人才会响应
- 其他成员可以看到对话
- 支持多轮对话

### 4.2 Slack 用户体验

#### DM 场景

**用户操作流程**:
1. 在 Slack 中打开与机器人的 DM
2. 发送消息："help me write an email"
3. 机器人回复：邮件草稿

**预期体验**:
- 响应时间：2-3 秒
- 消息格式：纯文本
- 支持英文和多语言

#### 频道场景

**用户操作流程**:
1. 在频道中 @ 机器人
2. 发送消息："@bot what's the status?"
3. 机器人在频道回复：状态信息

**预期体验**:
- 必须有 @ 机器人才会响应
- 其他成员可以看到对话
- 支持线程回复（后续版本）

### 4.3 错误体验

#### Agent 调用失败

**错误提示**:
- 飞书："抱歉，处理消息时出错，请稍后重试。"
- Slack："Sorry, something went wrong. Please try again later."

#### 网络错误

**错误提示**:
- 飞书："网络连接异常，正在重试..."
- Slack："Connection issue, retrying..."

---

## 5. 接口设计

### 5.1 Integrations → Server

#### 调用 Agent 接口

**请求**:
```http
POST /sessions/{sessionId}/chat HTTP/1.1
Content-Type: application/json

{
  "message": "用户消息内容",
  "enabledTools": ["tool1", "tool2"],
  "maxIterations": 10
}
```

**响应** (SSE 流):
```
event: start
data: {"type":"start","runId":"xxx","seq":0,...}

event: thinking
data: {"type":"thinking","runId":"xxx","seq":1,...}

event: tool_use
data: {"type":"tool_use","runId":"xxx","seq":2,...}

event: content
data: {"type":"content","runId":"xxx","seq":3,...}

event: complete
data: {"type":"complete","runId":"xxx","seq":4,...}
```

### 5.2 环境变量配置

```bash
# ===== Server =====
LLM_API_KEY=your-llm-api-key
LLM_BASE_URL=https://api.moonshot.cn/v1
LLM_MODEL=kimi-k2.5
PORT=3000

# ===== Integrations - 飞书 =====
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxx
FEISHU_DOMAIN=feishu
FEISHU_BOT_ID=xxxxxxxx
AGENT_API_URL=http://localhost:3000

# ===== Integrations - Slack =====
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_APP_TOKEN=xapp-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_BOT_ID=Uxxxxxxxx
AGENT_API_URL=http://localhost:3000
```

---

## 6. 实施计划

### 6.1 迭代规划

#### Phase 1: 基础架构（1-2 天）

**目标**: 搭建 Integrations 包的基础设施

**任务列表**:
- [ ] 创建 `packages/integrations` 包结构
- [ ] 配置 TypeScript 和构建脚本
- [ ] 实现共享模块（logger, errors, types）
- [ ] 实现 HTTP Client（调用 Agent API）
- [ ] 实现 Session Manager（会话映射管理）
- [ ] 实现 Message Store（消息持久化）
- [ ] 编写基础单元测试

**验收标准**:
- 完整的项目结构
- 可运行的空壳服务
- 完整的类型定义

#### Phase 2: 飞书集成（2-3 天）

**目标**: 完成飞书 WebSocket 集成

**任务列表**:
- [ ] 安装 `@larksuiteoapi/node-sdk`
- [ ] 实现 FeishuClient（WebSocket 客户端）
- [ ] 实现 FeishuHandlers（消息处理器）
- [ ] 实现消息解析和 @ 提取
- [ ] 集成 Agent API 调用
- [ ] 实现消息发送
- [ ] 编写集成测试
- [ ] 本地测试验证

**验收标准**:
- 可运行的飞书机器人
- 完整的消息处理流程
- 测试报告

#### Phase 3: Slack 集成（2-3 天）

**目标**: 完成 Slack Socket Mode 集成

**任务列表**:
- [ ] 安装 `@slack/bolt`
- [ ] 实现 SlackClient（Socket Mode 客户端）
- [ ] 实现 SlackHandlers（消息处理器）
- [ ] 实现 @ 提及检测和清理
- [ ] 集成 Agent API 调用
- [ ] 实现消息发送
- [ ] 编写集成测试
- [ ] 本地测试验证

**验收标准**:
- 可运行的 Slack 机器人
- 完整的消息处理流程
- 测试报告

#### Phase 4: 完善和优化（1-2 天）

**目标**: 提升稳定性和性能

**任务列表**:
- [ ] 错误处理和重连优化
- [ ] 日志和监控完善
- [ ] 性能优化（连接池、批处理、缓存）
- [ ] 安全加固
- [ ] 文档完善
- [ ] 部署脚本和配置

**验收标准**:
- 生产就绪的服务
- 完整的文档
- 部署指南

#### Phase 5: 测试和发布（1 天）

**目标**: 确保质量并发布

**任务列表**:
- [ ] 端到端测试
- [ ] 性能测试
- [ ] 压力测试
- [ ] Bug 修复
- [ ] 编写用户文档
- [ ] 发布到生产环境

**验收标准**:
- 测试报告
- 用户手册
- 生产环境运行

### 6.2 里程碑

| 里程碑 | 日期 | 交付物 |
|--------|------|--------|
| M1: 基础架构完成 | D+2 | Integrations 包框架 |
| M2: 飞书集成完成 | D+5 | 可用的飞书机器人 |
| M3: Slack 集成完成 | D+8 | 可用的 Slack 机器人 |
| M4: 生产就绪 | D+10 | 完整文档和部署脚本 |
| M5: 生产发布 | D+11 | 生产环境运行 |

### 6.3 资源需求

**人力资源**:
- 后端开发：1 人
- 测试：0.5 人（兼职）
- 项目管理：0.2 人（兼职）

**技术资源**:
- 飞书开发者账号
- Slack Workspace
- 开发服务器（本地开发即可）

---

## 7. 风险与应对

### 7.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 长连接不稳定 | 中 | 高 | 使用 SDK 内置重连，实现降级策略 |
| Agent API 性能瓶颈 | 低 | 中 | 添加缓存和队列，优化调用频率 |
| 消息丢失 | 低 | 中 | 实现消息确认机制，添加重试 |
| SDK 兼容性问题 | 低 | 低 | 选择官方维护的 SDK，及时更新 |

### 7.2 业务风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 用户使用频率低 | 中 | 中 | 优化用户体验，添加使用指南 |
| 企业 IM 平台限制 | 低 | 高 | 提前了解限制，设计规避方案 |
| 安全合规问题 | 低 | 高 | 遵循最小权限原则，定期审计 |

### 7.3 项目风险

| 风险 | 概率 | 影响 | 应对措施 |
|------|------|------|----------|
| 开发进度延期 | 中 | 中 | 预留缓冲时间，分阶段交付 |
| 需求变更 | 中 | 低 | 采用敏捷开发，快速响应变更 |
| 人员流动 | 低 | 高 | 完善文档，知识共享 |

---

## 8. 成功指标

### 8.1 业务指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 日活跃用户 | 50+ | 统计发送消息的用户数 |
| 消息处理成功率 | > 99% | (成功消息数 / 总消息数) |
| 平均响应时间 | < 3 秒 | 统计从接收到回复的时间 |
| 用户满意度 | > 4.0/5.0 | 用户反馈评分 |

### 8.2 技术指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 服务可用性 | > 99% | (正常运行时间 / 总时间) |
| 消息丢失率 | < 0.1% | (丢失消息数 / 总消息数) |
| 连接稳定性 | > 99% | (正常连接时间 / 总时间) |
| 错误率 | < 1% | (错误消息数 / 总消息数) |

### 8.3 里程碑达成

| 里程碑 | 成功标准 |
|--------|----------|
| M1 | 基础架构验收通过 |
| M2 | 飞书机器人可演示 |
| M3 | Slack 机器人可演示 |
| M4 | 文档完整，可部署 |
| M5 | 生产环境稳定运行 |

---

## 9. 后续规划

### 9.1 短期规划（1-3 个月）

**功能增强**:
- 支持消息卡片和交互组件
- 支持文件上传和处理
- 支持消息编辑和删除
- 添加简单的管理后台

**体验优化**:
- 支持多语言
- 优化错误提示
- 添加使用指南

### 9.2 中期规划（3-6 个月）

**平台扩展**:
- 支持更多 IM 平台（Discord、Teams、钉钉）
- 支持 Webhook 模式
- 支持多租户隔离

**功能增强**:
- 支持权限管理
- 支持消息加密
- 支持高级统计和分析

### 9.3 长期规划（6-12 个月）

**企业化**:
- 支持私有化部署
- 支持 SaaS 模式
- 提供企业级支持

**智能化**:
- 支持 Agent 自定义
- 支持知识库集成
- 支持工作流自动化

---

## 10. 附录

### 10.1 术语表

| 术语 | 说明 |
|------|------|
| IM | 即时通讯（Instant Messaging） |
| WebSocket | 一种在单个 TCP 连接上进行全双工通信的协议 |
| SSE | Server-Sent Events，服务器推送事件的技术 |
| SDK | Software Development Kit，软件开发工具包 |
| @提及 | 在群聊中通过 @ 符号提醒特定用户 |

### 10.2 参考资料

**飞书**:
- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [飞书 WebSocket 长连接](https://open.feishu.cn/document/ukTMukTMukTM/uYDNxYjL2QTM24iN0EjN/event-subscription-guide/long-connection-mode)

**Slack**:
- [Slack API 文档](https://api.slack.com/)
- [Slack Bolt 框架](https://slack.dev/bolt-js/)
- [Slack Socket Mode](https://api.slack.dev/apis/events-api/using-socket-mode/)

**相关技术**:
- [SSE (Server-Sent Events)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Hono](https://hono.dev/)
- [Bun](https://bun.sh/)

### 10.3 相关文档

- [little-thing 架构文档](../ARCHITECTURE.md)
- [Agent 框架设计](../../plans/2025-03-01-agent-platform-design.md)
- [开发指南](../DEV-GUIDELINES-BACKEND.md)
- [测试指南](../TESTING.md)

---

**文档结束**

如有疑问或建议，请联系项目维护者。

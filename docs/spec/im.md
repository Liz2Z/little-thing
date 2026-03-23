
   飞书 & Slack 长连接集成技术方案

   文档版本: v1.0
   创建日期: 2025-03-22
   优先级: 高
   实施顺序: 先飞书后 Slack

   ──────────────────────────────────────────

   📋 目录

   1. [项目概述](#项目概述)
   2. [技术选型对比](#技术选型对比)
   3. [架构设计](#架构设计)
   4. [数据模型设计](#数据模型设计)
   5. [飞书集成方案](#飞书集成方案)
   6. [Slack 集成方案](#slack-集成方案)
   7. [通信协议设计](#通信协议设计)
   8. [错误处理与重连](#错误处理与重连)
   9. [部署方案](#部署方案)
   10. [安全考虑](#安全考虑)
   11. [测试方案](#测试方案)
   12. [性能优化](#性能优化)
   13. [监控与日志](#监控与日志)
   14. [实施路线图](#实施路线图)

   ──────────────────────────────────────────

   项目概述

   目标

   为 little-thing 平台添加飞书和 Slack 机器人能力，使得用户可以通过企业 IM
   平台与 Agent 进行交互。

   核心需求

   1. 长连接模式: 使用 WebSocket 长连接接收消息，无需公网 IP 和内网穿透
   2. Agent 集成: 将 IM 消息转发到 Agent 处理，并返回 Agent 响应
   3. 消息持久化: 保存 IM 平台消息历史，关联 Agent 会话
   4. 多租户支持: 支持多个聊天/频道同时接入
   5. 基础重连: 依赖 SDK 默认重连机制

   ──────────────────────────────────────────

   技术选型对比

   长连接模式对比

| 特性 | 飞书 WebSocket | Slack Socket Mode | Webhook 模式 |
|------|---------------|-------------------|--------------|
| **无需公网 IP** | ✅ | ✅ | ❌ 需要公网地址 |
| **本地开发友好** | ✅ | ✅ | ❌ 需要内网穿透 |
| **消息加密** | 建连后明文 | TLS 加密 | 取决于实现 |
| **连接数限制** | 未明确限制 | 最多 10 个 | 无限制 |
| **应用上架** | ✅ 支持 | ❌ 不支持 | ✅ 支持 |
| **开发周期** | ~5 分钟 | ~几分钟 | ~1 周 |


   结论: 长连接模式在开发体验和性能上显著优于 Webhook，推荐使用。

   SDK 选型

   飞书
   •  选择: @larksuiteoapi/node-sdk（官方推荐，版本 1.59.0）

   Slack
   •  选择: @slack/bolt（官方推荐框架，版本 4.6.0）

   ──────────────────────────────────────────

   架构设计

   整体架构图

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
     ┌────────▼────────────────────────────▼─────────┐
     │              Server (现有服务)                  │
     │  ┌────────────┐  ┌────────────┐               │
     │  │   Session  │  │   Agent    │               │
     │  │   Routes   │  │   Core     │               │
     │  └────────────┘  └────────────┘               │
     └─────────────────────────────────────────────────┘

   目录结构

     packages/
     ├── integrations/                    # 新建独立包
     │   ├── src/
     │   │   ├── feishu/                  # 飞书集成
     │   │   │   ├── client.ts
     │   │   │   ├── handlers.ts
     │   │   │   ├── types.ts
     │   │   │   ├── config.ts
     │   │   │   └── index.ts
     │   │   ├── slack/                   # Slack 集成
     │   │   │   ├── client.ts
     │   │   │   ├── handlers.ts
     │   │   │   ├── types.ts
     │   │   │   ├── config.ts
     │   │   │   └── index.ts
     │   │   ├── shared/                  # 共享模块
     │   │   │   ├── http-client.ts
     │   │   │   ├── message-store.ts
     │   │   │   ├── session-manager.ts
     │   │   │   ├── types.ts
     │   │   │   ├── logger.ts
     │   │   │   └── errors.ts
     │   │   ├── index.ts
     │   │   └── config.ts
     │   ├── storage/
     │   │   ├── integrations.jsonl
     │   │   ├── feishu-messages.jsonl
     │   │   └── slack-messages.jsonl
     │   ├── package.json
     │   └── tsconfig.json

   ──────────────────────────────────────────

   数据模型设计

   会话映射

   ```typescript
   interface IntegrationMapping {
       id: string;
       platform: 'feishu' | 'slack';
       platformChatId: string;      // 飞书: chat_id, Slack: channel_id
       sessionId: string;           // Agent Session ID
       metadata: {
         name?: string;
         type?: 'private' | 'group' | 'channel';
         createdAt: string;
         lastActiveAt: string;
         messageCount: number;
       };
       status: 'active' | 'archived' | 'disabled';
     }
     
```
   平台消息

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
   ──────────────────────────────────────────

   飞书集成方案

   核心代码结构

   client.ts

   ```typescript
     import * as lark from '@larksuiteoapi/node-sdk';

     export class FeishuClient {
       private client: lark.Client;      // API 客户端（发送消息）
       private wsClient: lark.WSClient;  // WebSocket 客户端（接收消息）
       private handlers: FeishuHandlers;

       async start(): Promise<void> {
         await this.wsClient.start({
           eventDispatcher: new lark.EventDispatcher({
             encryptKey: this.config.encryptKey,
           }).register({
             'im.message.receive_v1':
     this.handlers.handleMessageReceive.bind(this.handlers),
           }),
         });
       }

       async sendTextMessage(chatId: string, text: string): Promise<void> {
         await this.client.im.message.create({
           params: { receive_id_type: 'chat_id' },
           data: {
             receive_id: chatId,
             content: JSON.stringify({ text }),
             msg_type: 'text',
           },
         });
       }
     }
     
```
   handlers.ts

   ```typescript
     export class FeishuHandlers {
       async handleMessageReceive(data: MessageReceiveEvent): Promise<void> {
         // 1. 解析消息内容
         const content = this.parseMessageContent(message.content);

         // 2. 检查是否需要 @ 机器人（群聊）
         if (message.chat_type === 'group') {
           const mentions = this.extractMentions(message.content);
           if (!mentions.includes(this.config.botId)) {
             return; // 忽略未 @ 的消息
           }
         }

         // 3. 获取或创建会话映射
         const mapping = await this.sessionManager.getOrCreateMapping({
           platform: 'feishu',
           platformChatId: chat_id,
         });

         // 4. 保存传入消息
         await this.messageStore.saveMessage({...});

         // 5. 调用 Agent
         for await (const event of this.agentClient.chat(mapping.sessionId,
     content)) {
           // 处理事件流
         }

         // 6. 发送回复到飞书
         await this.apiClient.im.message.create({...});

         // 7. 保存传出消息
         await this.messageStore.saveMessage({...});
       }
     }
     
```
   ──────────────────────────────────────────

   Slack 集成方案

   核心代码结构

   client.ts

   ```typescript
     import { App } from '@slack/bolt';

     export class SlackClient {
       private app: App;

       constructor(private config: SlackConfig) {
         this.app = new App({
           token: config.botToken,
           appToken: config.appToken,
           socketMode: true,
         });

         this.setupEventHandlers();
       }

       private setupEventHandlers(): void {
         this.app.message(async ({ message, say, client }) => {
           await this.handlers.handleMessage({ message, say, client });
         });

         this.app.event('app_mention', async ({ event, say, client }) => {
           await this.handlers.handleAppMention({ event, say, client });
         });
       }

       async start(): Promise<void> {
         await this.app.start();
       }
     }
     
```
   handlers.ts

   ```typescript
     export class SlackHandlers {
       async handleMessage(context: MessageContext): Promise<void> {
         const { message, say, client } = context;

         // 忽略机器人消息
         if (message.subtype === 'bot_message') {
           return;
         }

         // 私聊直接处理，群聊检查 @
         const channelType = await this.getChannelType(client,
     message.channel);
         const shouldProcess = channelType === 'im' ||
     this.isBotMentioned(message.text);

         if (!shouldProcess) {
           return;
         }

         // 清理 @ 提及
         const cleanText = this.cleanBotMention(message.text);

         // 调用 Agent 并发送回复
         // ...
       }
     }
     
```
   ──────────────────────────────────────────

   通信协议设计

   Agent API 调用

   ```typescript
     export class AgentClient {
       async *chat(
         sessionId: string,
         message: string
       ): AsyncGenerator<AgentEvent> {
         const url = `${this.baseUrl}/sessions/${sessionId}/chat`;

         const response = await fetch(url, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message }),
         });

         // 解析 SSE 流
         const reader = response.body?.getReader();
         const decoder = new TextDecoder();

         while (true) {
           const { done, value } = await reader.read();
           if (done) break;

           // 解析 SSE 事件
           const event = this.parseSSEEvent(decoder.decode(value));
           yield event;
         }
       }
     }
     
```
   ──────────────────────────────────────────

   错误处理与重连

   错误分类

   ```typescript
     enum IntegrationErrorType {
       NetworkError = 'NetworkError',
       AuthenticationError = 'AuthenticationError',
       APIError = 'APIError',
       MessageParseError = 'MessageParseError',
       AgentError = 'AgentError',
     }
     
```
   重连策略

   •  飞书: SDK 内置自动重连
   •  Slack: Bolt 框架内置 Socket Mode 重连

   ──────────────────────────────────────────

   部署方案

   开发环境

   ```bash
     # 终端 1: Server
     bun run dev:server

     # 终端 2: Integrations (飞书)
     bun run dev:feishu

     # 终端 3: Integrations (Slack)
     bun run dev:slack
   ```
   生产环境 (Docker Compose)

   ```yaml
     services:
       server:
         image: littlething-server
         ports:
           - "3000:3000"

       integrations:
         image: littlething-integrations
         depends_on:
           - server
         environment:
           - AGENT_API_URL=http://server:3000
   ```
   ──────────────────────────────────────────

   实施路线图

   Phase 1: 基础架构（1-2 天）
   •  创建 packages/integrations 包
   •  实现共享模块
   •  配置构建脚本

   Phase 2: 飞书集成（2-3 天）
   •  实现 FeishuClient 和 Handlers
   •  集成 Agent API
   •  本地测试验证

   Phase 3: Slack 集成（2-3 天）
   •  实现 SlackClient 和 Handlers
   •  集成 Agent API
   •  本地测试验证

   Phase 4: 完善和优化（1-2 天）
   •  错误处理和重连
   •  日志和监控
   •  性能优化

   Phase 5: 测试和发布（1 天）
   •  端到端测试
   •  文档完善
   •  生产部署

   ──────────────────────────────────────────

   附录

   A. 环境变量清单

   bash
     # Server
     LLM_API_KEY=your-key
     LLM_BASE_URL=https://api.moonshot.cn/v1
     LLM_MODEL=kimi-k2.5

     # 飞书
     FEISHU_APP_ID=cli_xxx
     FEISHU_APP_SECRET=xxx
     FEISHU_ENCRYPT_KEY=xxx
     FEISHU_BOT_ID=xxx

     # Slack
     SLACK_BOT_TOKEN=xoxb-xxx
     SLACK_APP_TOKEN=xapp-xxx
     SLACK_BOT_ID=Uxxx

     # Integrations
     AGENT_API_URL=http://localhost:3000

   B. 飞书应用配置步骤

   1. 访问[飞书开放平台](https://open.feishu.cn/app)创建企业自建应用
   2. 获取 App ID 和 App Secret
   3. 配置权限：im:message、im:message:group_at_msg
   4. 启用长连接订阅
   5. 发布应用到企业

   C. Slack 应用配置步骤

   1. 访问 [Slack API](https://api.slack.com/apps) 创建应用
   2. 启用 Socket Mode
   3. 配置 Bot Token Scopes：chat:write、channels:history 等
   4. 订阅事件：message.channels、app_mention 等
   5. 安装到工作区

   ──────────────────────────────────────────

   这个技术方案涵盖了从架构设计到具体实现的所有细节。你可以按照这个方案逐步实
   施，如果需要我帮助创建具体的代码文件，请告诉我！
# Agent ReAct 功能升级计划

## 目标

将现有的对话系统升级为支持 ReAct (Reasoning + Acting) 模式的 Agent 系统，使 LLM 能够：

1. 加载并使用工具（Tools）
2. 进行推理（Reasoning）
3. 执行行动（Acting）
4. 观察结果（Observation）
5. 循环直到完成任务

## 当前状态分析

### 已有基础

* **Server**: Hono HTTP 服务，支持会话管理和消息存储

* **LLM Provider**: Anthropic 格式，支持 GLM/Kimi

* **Tools**: 已实现 `ls`, `read`, `edit`, `write`, `grep` 工具

* **CLI**: 交互式对话客户端

* **Web**: 基础 Web 界面

### 需要升级的部分

1. LLM Provider 需要支持 `tools` 参数
2. 需要实现 ReAct 循环逻辑
3. 需要支持工具调用和结果反馈
4. 需要扩展消息类型以支持工具调用

## 详细实施步骤

### Phase 1: 扩展类型定义

#### 1.1 更新 Message 类型

**文件**: `packages/server/src/session/types.ts`

添加工具调用相关的消息类型：

* `tool_use` - LLM 请求调用工具

* `tool_result` - 工具执行结果

```typescript
export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: ToolName;
  input: ToolParams;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type MessageContent = string | (ToolUseContent | ToolResultContent)[];

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
  timestamp: string;
}
```

#### 1.2 定义 Agent 事件类型（支持并发和嵌套）

**文件**: `packages/server/src/agent/types.ts`

采用事件驱动架构，支持并发 Agent 执行和嵌套调用：

```typescript
/**
 * 事件状态枚举
 */
export enum EventStatus {
  Start = 'start',
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Agent 停止原因枚举
 */
export enum AgentStopReason {
  EndTurn = 'end_turn',           // 正常结束，LLM 决定回复用户
  ToolUse = 'tool_use',           // 需要调用工具
  MaxTokens = 'max_tokens',       // 达到最大 token 限制
  StopSequence = 'stop_sequence', // 遇到停止序列
  MaxIterations = 'max_iterations', // 达到最大迭代次数
  UserAbort = 'user_abort',       // 用户主动终止
  Error = 'error',                // 发生错误
  Timeout = 'timeout',            // 超时
}

/**
 * Agent 错误类型枚举
 */
export enum AgentErrorType {
  LlmError = 'llm_error',
  ToolError = 'tool_error',
  Timeout = 'timeout',
  MaxIterations = 'max_iterations',
  UserAbort = 'user_abort',
  Unknown = 'unknown',
}

/**
 * Agent 事件类型枚举
 */
export enum AgentEventType {
  Start = 'agent_start',
  Thinking = 'agent_thinking',
  Content = 'agent_content',
  ToolUse = 'tool_use',
  Complete = 'agent_complete',
  Error = 'agent_error',
  Abort = 'agent_abort',
}

/**
 * Agent 事件基础接口
 * 所有事件都包含追踪标识，用于处理并发和嵌套场景
 * 
 * 重要：同一个 run 里的所有事件 run_id 都是相同的，
 * 包括子 agent 调用，通过 parent_span_id 区分层级
 */
export interface AgentEventBase {
  /** 事件类型 */
  type: AgentEventType;
  /** 
   * 运行实例 ID - 标识一次完整的 Agent 运行
   * 用于区分并发执行的多个 Agent 实例
   * 同一次运行中所有事件（包括子 agent）共享同一个 run_id
   */
  run_id: string;
  /** 
   * 序列号 - 同一 run_id 内的事件顺序
   * 前端可根据 seq 排序渲染，防止网络乱序
   */
  seq: number;
  /** 
   * Span ID - 当前事件的唯一标识
   * 用于构建调用链和关联父子关系
   */
  span_id: string;
  /** 
   * 父 Span ID - 标识父级事件
   * 用于支持嵌套调用（如子 agent）
   * 根事件为 null
   */
  parent_span_id: string | null;
  /** 事件时间戳 */
  timestamp: string;
  /** 
   * 事件状态
   * 用于表示事件的生命周期状态
   */
  status: EventStatus;
}

/** Agent 运行开始事件 */
export interface AgentStartEvent extends AgentEventBase {
  type: '';
  status: EventStatus.Start;
  /** 初始消息 */
  message: string;
  /** 启用的工具列表 */
  enabled_tools: string[];
  /** 最大迭代次数 */
  max_iterations: number;
}

/** Agent 思考事件 - LLM 内部思考过程 */
export interface AgentThinkingEvent extends AgentEventBase {
  type: AgentEventType.Thinking;
  status: EventStatus.Start | EventStatus.Completed;
  /** 思考内容 */
  content: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** Agent 文本输出事件 */
export interface AgentContentEvent extends AgentEventBase {
  type: AgentEventType.Content;
  status: EventStatus.Start | EventStatus.Pending | EventStatus.Completed;
  /** 文本内容（流式时可能分段） */
  content: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** 工具调用事件 */
export interface ToolUseEvent extends AgentEventBase {
  type: AgentEventType.ToolUse;
  status: EventStatus.Start | EventStatus.Pending | EventStatus.Completed | EventStatus.Failed;
  /** 工具调用 ID */
  tool_use_id: string;
  /** 工具名称 */
  tool_name: string;
  /** 工具输入参数 */
  input: unknown;
  /** 当前迭代轮次 */
  iteration: number;
  /** 执行结果（status 为 completed/failed 时） */
  result?: string;
  /** 错误信息（status 为 failed 时） */
  error?: string;
  /** 执行耗时（毫秒） */
  duration_ms?: number;
}

/** Agent 运行完成事件 */
export interface AgentCompleteEvent extends AgentEventBase {
  type: AgentEventType.Complete;
  status: EventStatus.Completed;
  /** 最终回复内容 */
  final_content: string;
  /** 总迭代次数 */
  total_iterations: number;
  /** 停止原因 */
  stop_reason: AgentStopReason;
  /** Token 使用情况 */
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

/** Agent 运行错误事件 */
export interface AgentErrorEvent extends AgentEventBase {
  type: AgentEventType.Error;
  status: EventStatus.Failed;
  /** 错误信息 */
  error: string;
  /** 错误类型 */
  error_type: AgentErrorType;
  /** 当前迭代轮次 */
  iteration?: number;
}

/** Agent 终止事件 - 用户主动终止 */
export interface AgentAbortEvent extends AgentEventBase {
  type: AgentEventType.Abort;
  status: EventStatus.Completed;
  /** 终止原因 */
  reason: string;
  /** 当前迭代轮次 */
  iteration: number;
}

/** 所有 Agent 事件类型联合 */
export type AgentEvent =
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentContentEvent
  | ToolUseEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentAbortEvent;

/**
 * Agent 运行上下文
 * 用于管理一次 Agent 运行的状态和追踪信息
 */
export interface AgentRunContext {
  /** 运行 ID */
  run_id: string;
  /** 父级 Span ID（用于嵌套调用） */
  parent_span_id: string | null;
  /** 当前序列号计数器 */
  seq_counter: number;
  /** 当前迭代轮次 */
  iteration: number;
  /** 最大迭代次数 */
  max_iterations: number;
  /** 已启用的工具 */
  enabled_tools: string[];
  /** 是否被终止 */
  aborted: boolean;
  
  /**
   * 生成下一个序列号
   */
  nextSeq(): number;
  
  /**
   * 生成新的 Span ID
   */
  newSpanId(): string;
  
  /**
   * 创建子上下文（用于嵌套调用，共享 run_id）
   */
  createChildSpan(): AgentRunContext;
  
  /**
   * 标记为终止
   */
  abort(): void;
  
  /**
   * 检查是否已终止
   */
  isAborted(): boolean;
}
```

#### 1.3 更新 LLM Provider 类型

**文件**: `packages/server/src/providers/types.ts`

添加工具支持和流式事件（Provider 枚举独立定义）：

```typescript
/**
 * LLM Provider 停止原因枚举（独立于 Agent 枚举）
 */
export enum ProviderStopReason {
  EndTurn = 'end_turn',
  ToolUse = 'tool_use',
  MaxTokens = 'max_tokens',
  StopSequence = 'stop_sequence',
}

/**
 * LLM Provider 流式事件类型枚举
 */
export enum ProviderStreamEventType {
  Content = 'content',
  Thinking = 'thinking',
  ToolUse = 'tool_use',
  Stop = 'stop',
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
  tools?: ToolDefinition[];
}

/** LLM 流式响应事件 */
export interface LLMStreamEvent {
  type: ProviderStreamEventType;
  content?: string;
  thinking?: string;
  tool_use?: {
    id: string;
    name: string;
    input: unknown;
  };
  stop_reason?: ProviderStopReason;
}
```

### Phase 2: 实现 Agent 核心

#### 2.1 创建 Agent 上下文管理器

**文件**: `packages/server/src/agent/context.ts`

```typescript
import { randomUUID } from 'crypto';
import type { AgentRunContext } from './types.js';

export function createAgentRunContext(
  enabled_tools: string[],
  max_iterations: number = 10,
  parent_span_id: string | null = null,
  run_id?: string
): AgentRunContext {
  const actual_run_id = run_id || randomUUID();
  let seq = 0;
  let aborted = false;
  
  return {
    run_id: actual_run_id,
    parent_span_id,
    seq_counter: 0,
    iteration: 0,
    max_iterations,
    enabled_tools,
    aborted,
    
    nextSeq(): number {
      return ++seq;
    },
    
    newSpanId(): string {
      return `${actual_run_id}-${++seq}`;
    },
    
    createChildSpan(): AgentRunContext {
      return createAgentRunContext(
        this.enabled_tools,
        this.max_iterations,
        this.newSpanId(),
        this.run_id
      );
    },
    
    abort(): void {
      aborted = true;
    },
    
    isAborted(): boolean {
      return aborted;
    },
  };
}
```

#### 2.2 创建 Agent 类

**文件**: `packages/server/src/agent/agent.ts`

实现 ReAct 循环，支持事件驱动、追踪和终止机制：

```typescript
import { randomUUID } from 'crypto';
import type { AnthropicProvider } from '../providers/anthropic.js';
import type { ToolRegistry } from '../tools/registry.js';
import type { Message } from '../session/types.js';
import { 
  AgentEventType,
  EventStatus,
  AgentStopReason,
  AgentErrorType,
  type AgentEvent, 
  type AgentRunContext,
  type AgentStartEvent,
  type AgentThinkingEvent,
  type AgentContentEvent,
  type ToolUseEvent,
  type AgentCompleteEvent,
  type AgentErrorEvent,
  type AgentAbortEvent,
} from './types.js';
import { createAgentRunContext } from './context.js';
import { ProviderStopReason } from '../providers/types.js';

export class Agent {
  private activeRuns: Map<string, AgentRunContext> = new Map();

  constructor(
    private provider: AnthropicProvider,
    private toolRegistry: ToolRegistry,
    private defaultMaxIterations: number = 10
  ) {}

  abort(runId: string): boolean {
    const ctx = this.activeRuns.get(runId);
    if (ctx) {
      ctx.abort();
      return true;
    }
    return false;
  }

  async *run(
    message: string,
    messages: Message[],
    options: {
      enabledTools?: string[];
      maxIterations?: number;
      runId?: string;
      abortSignal?: AbortSignal;
    } = {}
  ): AsyncGenerator<AgentEvent> {
    const ctx = createAgentRunContext(
      options.enabledTools || this.toolRegistry.getAllToolNames(),
      options.maxIterations || this.defaultMaxIterations,
      null,
      options.runId
    );

    this.activeRuns.set(ctx.run_id, ctx);

    yield this.createEvent<AgentStartEvent>(ctx, {
      type: AgentEventType.Start,
      status: EventStatus.Start,
      message,
      enabled_tools: ctx.enabled_tools,
      max_iterations: ctx.max_iterations,
    });

    try {
      messages = [...messages, {
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
      }];

      for (ctx.iteration = 0; ctx.iteration < ctx.max_iterations; ctx.iteration++) {
        if (ctx.isAborted() || options.abortSignal?.aborted) {
          yield this.createEvent<AgentAbortEvent>(ctx, {
            type: AgentEventType.Abort,
            status: EventStatus.Completed,
            reason: 'User requested abort',
            iteration: ctx.iteration,
          });
          return;
        }

        const tools = ctx.enabled_tools.map(name => 
          this.toolRegistry.getDefinition(name)
        );

        const response = await this.provider.chatWithTools(messages, tools);

        if (response.thinking) {
          yield this.createEvent<AgentThinkingEvent>(ctx, {
            type: AgentEventType.Thinking,
            status: EventStatus.Completed,
            content: response.thinking,
            iteration: ctx.iteration,
          });
        }

        if (response.toolUses && response.toolUses.length > 0) {
          for (const toolUse of response.toolUses) {
            if (ctx.isAborted() || options.abortSignal?.aborted) {
              yield this.createEvent<AgentAbortEvent>(ctx, {
                type: AgentEventType.Abort,
                status: EventStatus.Completed,
                reason: 'User requested abort during tool execution',
                iteration: ctx.iteration,
              });
              return;
            }

            const toolSpan = ctx.createChildSpan();
            
            yield this.createEvent<ToolUseEvent>(toolSpan, {
              type: AgentEventType.ToolUse,
              status: EventStatus.Start,
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              input: toolUse.input,
              iteration: ctx.iteration,
            });

            const startTime = Date.now();
            let result: { success: boolean; output?: string; error?: string };
            
            try {
              result = await this.toolRegistry.execute(toolUse.name, toolUse.input);
            } catch (error) {
              result = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              };
            }
            const duration = Date.now() - startTime;

            yield this.createEvent<ToolUseEvent>(toolSpan, {
              type: AgentEventType.ToolUse,
              status: result.success ? EventStatus.Completed : EventStatus.Failed,
              tool_use_id: toolUse.id,
              tool_name: toolUse.name,
              input: toolUse.input,
              iteration: ctx.iteration,
              result: result.success ? result.output : undefined,
              error: result.success ? undefined : result.error,
              duration_ms: duration,
            });

            messages = addToolResultToMessages(messages, toolUse, result);
          }
        } else {
          if (response.content) {
            yield this.createEvent<AgentContentEvent>(ctx, {
              type: AgentEventType.Content,
              status: EventStatus.Completed,
              content: response.content,
              iteration: ctx.iteration,
            });
          }

          const assistantMessage: Message = {
            role: 'assistant',
            content: response.content,
            timestamp: new Date().toISOString(),
          };
          messages.push(assistantMessage);

          const stopReason = this.mapStopReason(response.stop_reason);

          yield this.createEvent<AgentCompleteEvent>(ctx, {
            type: AgentEventType.Complete,
            status: EventStatus.Completed,
            final_content: response.content,
            total_iterations: ctx.iteration + 1,
            stop_reason: stopReason,
            usage: response.usage,
          });

          return;
        }
      }

      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: '达到最大迭代次数限制',
        error_type: AgentErrorType.MaxIterations,
        iteration: ctx.iteration,
      });

    } catch (error) {
      yield this.createEvent<AgentErrorEvent>(ctx, {
        type: AgentEventType.Error,
        status: EventStatus.Failed,
        error: error instanceof Error ? error.message : 'Unknown error',
        error_type: AgentErrorType.Unknown,
        iteration: ctx.iteration,
      });
    } finally {
      this.activeRuns.delete(ctx.run_id);
    }
  }

  /**
   * 将 Provider 的停止原因映射为 Agent 的停止原因
   * Provider 和 Agent 的枚举是独立的
   */
  private mapStopReason(reason?: ProviderStopReason): AgentStopReason {
    switch (reason) {
      case ProviderStopReason.EndTurn:
        return AgentStopReason.EndTurn;
      case ProviderStopReason.ToolUse:
        return AgentStopReason.ToolUse;
      case ProviderStopReason.MaxTokens:
        return AgentStopReason.MaxTokens;
      case ProviderStopReason.StopSequence:
        return AgentStopReason.StopSequence;
      default:
        return AgentStopReason.EndTurn;
    }
  }

  private createEvent<T extends AgentEvent>(
    ctx: AgentRunContext,
    event: Omit<T, 'run_id' | 'seq' | 'span_id' | 'parent_span_id' | 'timestamp'>
  ): T {
    return {
      ...event,
      run_id: ctx.run_id,
      seq: ctx.nextSeq(),
      span_id: ctx.newSpanId(),
      parent_span_id: ctx.parent_span_id,
      timestamp: new Date().toISOString(),
    } as T;
  }
}

function addToolResultToMessages(
  messages: Message[],
  toolUse: { id: string; name: string; input: unknown },
  result: { success: boolean; output?: string; error?: string }
): Message[] {
  const toolUseMessage: Message = {
    role: 'assistant',
    content: [{
      type: 'tool_use',
      id: toolUse.id,
      name: toolUse.name,
      input: toolUse.input,
    }],
    timestamp: new Date().toISOString(),
  };

  const toolResultMessage: Message = {
    role: 'user',
    content: [{
      type: 'tool_result',
      tool_use_id: toolUse.id,
      content: result.success ? result.output : result.error,
      is_error: !result.success,
    }],
    timestamp: new Date().toISOString(),
  };

  return [...messages, toolUseMessage, toolResultMessage];
}
```

#### 2.3 更新 LLM Provider

**文件**: `packages/server/src/providers/anthropic.ts`

添加工具支持方法，支持解析 tool\_use：

```typescript
import type { ToolDefinition } from '../tools/types.js';

export interface ChatCompletionResponseWithTools {
  content: string;
  toolUses?: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

async chatWithTools(
  messages: Message[], 
  tools?: ToolDefinition[]
): Promise<ChatCompletionResponseWithTools> {
  const requestBody: ChatCompletionRequest = {
    model: this.config.model,
    messages: this.convertMessagesToAnthropicFormat(messages),
    max_tokens: 4096,
    tools: tools ? this.convertToolsToAnthropicFormat(tools) : undefined,
  };

  const response = await fetch(`${this.config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  // 解析响应内容
  const content: string[] = [];
  const toolUses: Array<{ id: string; name: string; input: unknown }> = [];

  for (const item of data.content || []) {
    if (item.type === 'text') {
      content.push(item.text);
    } else if (item.type === 'tool_use') {
      toolUses.push({
        id: item.id,
        name: item.name,
        input: item.input,
      });
    }
  }

  return {
    content: content.join(''),
    toolUses: toolUses.length > 0 ? toolUses : undefined,
    usage: data.usage,
  };
}

/**
 * 将内部消息格式转换为 Anthropic 格式
 */
private convertMessagesToAnthropicFormat(messages: Message[]): unknown[] {
  return messages.map(msg => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content,
      };
    }
    // 处理包含 tool_use/tool_result 的复杂内容
    return {
      role: msg.role,
      content: msg.content,
    };
  });
}

/**
 * 将工具定义转换为 Anthropic 格式
 */
private convertToolsToAnthropicFormat(tools: ToolDefinition[]): unknown[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: this.convertParameters(tool.parameters),
      required: Object.entries(tool.parameters)
        .filter(([, param]) => param.required)
        .map(([name]) => name),
    },
  }));
}

private convertParameters(params: Record<string, ToolParameter>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(params)) {
    result[name] = {
      type: param.type,
      description: param.description,
      ...(param.enum && { enum: param.enum }),
    };
  }
  return result;
}
```

### Phase 3: 更新 API 路由

#### 3.1 添加 Agent 聊天端点

**文件**: `packages/server/src/routes.ts`

添加新的端点，支持 SSE 流式返回 Agent 事件：

```typescript
import { Agent } from './agent/agent.js';
import { ToolRegistry } from './tools/registry.js';
import { AgentEventType, EventStatus, AgentErrorType } from './agent/types.js';

const toolRegistry = new ToolRegistry();
toolRegistry.registerAll(toolDefinitions);

const agent = new Agent(provider, toolRegistry);

app.post('/sessions/:id/agent/chat',
  describeRoute({
    operationId: 'agent.chat',
    summary: 'Agent 对话',
    description: '使用 Agent 模式进行对话，支持工具调用和 ReAct 循环，返回 SSE 事件流',
    tags: ['Agent'],
    responses: {
      200: {
        description: 'SSE 事件流',
        content: {
          'text/event-stream': {
            schema: resolver(z.object({
              event: z.string().meta({ description: '事件类型' }),
              data: z.string().meta({ description: '事件数据 JSON' }),
            })),
          },
        },
      },
    },
  }),
  validator('json', z.object({
    message: z.string().meta({ description: '用户消息' }),
    enabledTools: z.array(z.string()).optional().meta({ description: '启用的工具列表' }),
    maxIterations: z.number().optional().meta({ description: '最大迭代次数' }),
  })),
  async (c) => {
    const id = c.req.param('id');
    const { message, enabledTools, maxIterations } = c.req.valid('json');

    const session = sessionStore.getSession(id);
    if (!session) {
      return c.json({ error: 'Session not found' }, 404);
    }

    if (!llmConfig.apiKey) {
      return c.json({ error: 'LLM_API_KEY not configured' }, 500);
    }

    return streamSSE(c, async (stream) => {
      try {
        for await (const event of agent.run(message, session.messages, {
          enabledTools,
          maxIterations,
        })) {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });

          if (event.type === AgentEventType.Complete || event.type === AgentEventType.Error) {
            sessionStore.addMessage(id, {
              role: 'user',
              content: message,
              timestamp: new Date().toISOString(),
            });
            if (event.type === AgentEventType.Complete) {
              sessionStore.addMessage(id, {
                role: 'assistant',
                content: event.final_content,
                timestamp: new Date().toISOString(),
              });
            }
          }
        }
      } catch (error) {
        await stream.writeSSE({
          event: AgentEventType.Error,
          data: JSON.stringify({
            type: AgentEventType.Error,
            status: EventStatus.Failed,
            error: error instanceof Error ? error.message : 'Unknown error',
            error_type: AgentErrorType.Unknown,
            timestamp: new Date().toISOString(),
          }),
        });
      }
    });
  }
);

app.post('/sessions/:id/agent/abort',
  describeRoute({
    operationId: 'agent.abort',
    summary: '终止 Agent 运行',
    description: '终止当前正在运行的 Agent',
    tags: ['Agent'],
    responses: {
      200: {
        description: '终止成功',
        content: {
          'application/json': {
            schema: resolver(z.object({
              success: z.boolean().meta({ description: '是否成功' }),
            })),
          },
        },
      },
    },
  }),
  validator('json', z.object({
    run_id: z.string().meta({ description: '要终止的运行 ID' }),
  })),
  async (c) => {
    const { run_id } = c.req.valid('json');
    agent.abort(run_id);
    return c.json({ success: true });
  }
);
```

### Phase 4: 更新 CLI 客户端

#### 4.1 支持 Agent 模式

**文件**: `packages/cli/src/chat.ts`

移除普通对话模式，只保留 Agent 模式：

```typescript
import { 
  AgentEventType, 
  EventStatus, 
  type AgentEvent 
} from '@little-thing/server/agent/types';

// 新增命令
// /abort - 终止当前 Agent 运行

// 事件渲染示例
function renderEvent(event: AgentEvent) {
  switch (event.type) {
    case AgentEventType.Start:
      console.log(`🤖 Agent started (run: ${event.run_id.slice(0, 8)})`);
      break;
    case AgentEventType.Thinking:
      console.log(`💭 Thinking: ${event.content}`);
      break;
    case AgentEventType.ToolUse:
      if (event.status === EventStatus.Start) {
        console.log(`🔧 Tool: ${event.tool_name}`);
        console.log(`   Input: ${JSON.stringify(event.input)}`);
      } else if (event.status === EventStatus.Completed) {
        console.log(`✅ Tool completed (${event.duration_ms}ms)`);
        console.log(`   Result: ${event.result?.slice(0, 100)}...`);
      } else if (event.status === EventStatus.Failed) {
        console.log(`❌ Tool failed: ${event.error}`);
      }
      break;
    case AgentEventType.Content:
      console.log(`💬 ${event.content}`);
      break;
    case AgentEventType.Complete:
      console.log(`✨ Completed (${event.total_iterations} iterations)`);
      break;
    case AgentEventType.Abort:
      console.log(`🛑 Aborted: ${event.reason}`);
      break;
    case AgentEventType.Error:
      console.log(`❌ Error: ${event.error}`);
      break;
  }
}
```

### Phase 5: 工具系统增强

#### 5.1 工具注册表

**文件**: `packages/server/src/tools/registry.ts`

```typescript
export class ToolRegistry {
  private tools: Map<ToolName, ToolDefinition> = new Map();
  
  register(tool: ToolDefinition): void;
  get(name: ToolName): ToolDefinition;
  getAll(): ToolDefinition[];
  toAnthropicFormat(): AnthropicTool[];
}
```

#### 5.2 工具定义转换为 Anthropic 格式

```typescript
function convertToAnthropicFormat(tool: ToolDefinition): AnthropicTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: convertParameters(tool.parameters),
      required: getRequiredParameters(tool.parameters),
    },
  };
}
```

## 数据流设计

### 事件驱动架构

```
User Input
    ↓
[Agent.run] ──→ 生成 run_id
    ↓
agent_start (seq=1, status=start)
    ↓
LLM Call (with tools)
    ↓
agent_thinking (seq=2, status=start/completed)
    ↓
┌─────────────────────────────────────┐
│  Response has tool_use?             │
│  Yes → tool_use (seq=N, status=start)│
│        ↓                            │
│        Execute Tool                 │
│        ↓                            │
│        tool_use (seq=N, status=completed/failed) │
│        ↓                            │
│        Add Result → Continue Loop   │
│  No  → agent_content (seq=N, status=completed) │
│        ↓                            │
│        agent_complete (seq=N+1)     │
└─────────────────────────────────────┘
    ↓
Stream Events to Client:
  每个事件包含: run_id, seq, span_id, parent_span_id, status
```

### 并发 Agent 场景

```
Session
├── Agent Run A (run_id: "A", seq: 1,2,3,4...)
│   ├── agent_start (status=start)
│   ├── tool_use (status=start → completed)
│   └── agent_complete (status=completed)
│
└── Agent Run B (run_id: "B", seq: 1,2,3,4...)  ← 并发执行
    ├── agent_start (status=start)
    ├── tool_use (status=start → failed)
    └── agent_error (status=failed)

前端根据 run_id 分组，按 seq 排序渲染
```

### 嵌套调用场景（共享 run\_id）

```
Agent Run (run_id: "main")
├── agent_start (span_id: "main-1", parent: null, status=start)
├── agent_thinking (span_id: "main-2", parent: "main-1", status=completed)
├── tool_use (span_id: "main-3", parent: "main-1", status=start)
│   └── tool_use (span_id: "main-4", parent: "main-3", status=completed)
│       ↑ 同一个 run_id，通过 parent_span_id 表示嵌套
├── agent_content (span_id: "main-5", parent: "main-1", status=completed)
└── agent_complete (span_id: "main-6", parent: "main-1", status=completed)

前端可根据 parent_span_id 构建树形结构展示
```

### 用户终止流程

```
Agent Run (run_id: "main")
├── agent_start (seq=1, status=start)
├── agent_thinking (seq=2, status=completed)
├── tool_use (seq=3, status=start)
│   [用户点击终止]
├── agent_abort (seq=4, status=completed, reason="User requested abort")
└── (循环终止)

终止后不再产生新事件
```

## API 设计

### Agent Chat 请求

```json
POST /sessions/:id/agent/chat
{
  "message": "帮我查找项目中所有使用了 React 的文件",
  "enabledTools": ["ls", "read", "grep"],
  "maxIterations": 10
}
```

### Agent Chat 流式响应 (SSE)

每个事件都包含完整的追踪信息：

```
event: agent_start
data: {
  "type": "agent_start",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 1,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-1",
  "parent_span_id": null,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "status": "start",
  "message": "帮我查找项目中所有使用了 React 的文件",
  "enabled_tools": ["ls", "read", "grep"],
  "max_iterations": 10
}

event: agent_thinking
data: {
  "type": "agent_thinking",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 2,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-2",
  "parent_span_id": "550e8400-e29b-41d4-a716-446655440000-1",
  "timestamp": "2024-01-15T10:30:00.500Z",
  "status": "completed",
  "content": "用户想要查找 React 相关文件，我应该先使用 grep 搜索...",
  "iteration": 0
}

event: tool_use
data: {
  "type": "tool_use",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 3,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-3",
  "parent_span_id": "550e8400-e29b-41d4-a716-446655440000-1",
  "timestamp": "2024-01-15T10:30:01.000Z",
  "status": "start",
  "tool_use_id": "tool_001",
  "tool_name": "grep",
  "input": {"pattern": "React", "glob": "*.ts"},
  "iteration": 0
}

event: tool_use
data: {
  "type": "tool_use",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 4,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-4",
  "parent_span_id": "550e8400-e29b-41d4-a716-446655440000-3",
  "timestamp": "2024-01-15T10:30:02.500Z",
  "status": "completed",
  "tool_use_id": "tool_001",
  "tool_name": "grep",
  "input": {"pattern": "React", "glob": "*.ts"},
  "iteration": 0,
  "result": "src/components/Button.tsx...",
  "duration_ms": 1500
}

event: agent_content
data: {
  "type": "agent_content",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 5,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-5",
  "parent_span_id": "550e8400-e29b-41d4-a716-446655440000-1",
  "timestamp": "2024-01-15T10:30:03.000Z",
  "status": "completed",
  "content": "我找到了以下使用 React 的文件...",
  "iteration": 0
}

event: agent_complete
data: {
  "type": "agent_complete",
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 6,
  "span_id": "550e8400-e29b-41d4-a716-446655440000-6",
  "parent_span_id": "550e8400-e29b-41d4-a716-446655440000-1",
  "timestamp": "2024-01-15T10:30:03.500Z",
  "status": "completed",
  "final_content": "我找到了以下使用 React 的文件...",
  "total_iterations": 1,
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 200
  }
}
```

### 前端渲染策略

```typescript
import { 
  AgentEventType, 
  EventStatus, 
  AgentStopReason,
  type AgentEvent,
  type ToolUseEvent 
} from '@little-thing/server/agent/types';

// 1. 按 run_id 分组
const runs = groupBy(events, 'run_id');

// 2. 每个 run 内按 seq 排序（防止网络乱序）
const sortedEvents = events.sort((a, b) => a.seq - b.seq);

// 3. 根据 parent_span_id 构建树形结构
const tree = buildEventTree(events);

// 4. 根据事件类型和状态渲染
function renderEvent(event: AgentEvent) {
  switch (event.type) {
    case AgentEventType.Start:
      return <AgentStartEvent event={event} />;
    case AgentEventType.Thinking:
      return <ThinkingEvent content={event.content} status={event.status} />;
    case AgentEventType.ToolUse:
      return <ToolUseEventComponent event={event} />;
    case AgentEventType.Content:
      return <ContentEvent content={event.content} status={event.status} />;
    case AgentEventType.Complete:
      return <CompleteEventComponent event={event} />;
    case AgentEventType.Error:
      return <ErrorEventComponent event={event} />;
    case AgentEventType.Abort:
      return <AbortEventComponent event={event} />;
  }
}

// 5. 工具调用状态渲染
function renderToolUse(event: ToolUseEvent) {
  switch (event.status) {
    case EventStatus.Start:
      return (
        <div className="tool-use pending">
          <Spinner /> {event.tool_name}...
        </div>
      );
    case EventStatus.Pending:
      return (
        <div className="tool-use pending">
          <Spinner /> {event.tool_name} (执行中...)
        </div>
      );
    case EventStatus.Completed:
      return (
        <div className="tool-use completed">
          <CheckIcon /> {event.tool_name} ({event.duration_ms}ms)
          <pre>{event.result}</pre>
        </div>
      );
    case EventStatus.Failed:
      return (
        <div className="tool-use failed">
          <ErrorIcon /> {event.tool_name} 失败
          <pre className="error">{event.error}</pre>
        </div>
      );
  }
}

// 6. 停止原因显示
function getStopReasonText(reason: AgentStopReason): string {
  const reasonMap: Record<AgentStopReason, string> = {
    [AgentStopReason.EndTurn]: '正常完成',
    [AgentStopReason.ToolUse]: '需要调用工具',
    [AgentStopReason.MaxTokens]: '达到最大 token 限制',
    [AgentStopReason.StopSequence]: '遇到停止序列',
    [AgentStopReason.MaxIterations]: '达到最大迭代次数',
    [AgentStopReason.UserAbort]: '用户终止',
    [AgentStopReason.Error]: '发生错误',
    [AgentStopReason.Timeout]: '超时',
  };
  return reasonMap[reason];
}
```

## 文件变更清单

### 修改文件

1. `packages/server/src/session/types.ts` - 扩展 Message 类型
2. `packages/server/src/providers/types.ts` - 添加工具支持
3. `packages/server/src/providers/anthropic.ts` - 实现工具调用
4. `packages/server/src/routes.ts` - 添加 Agent 端点
5. `packages/server/src/tools/index.ts` - 增强工具导出
6. `packages/server/src/tools/types.ts` - 扩展工具类型
7. `packages/cli/src/chat.ts` - 支持 Agent 模式
8. `packages/cli/src/api.ts` - 添加 Agent API 方法

### 新增文件

1. `packages/server/src/agent/agent.ts` - Agent 核心实现
2. `packages/server/src/agent/types.ts` - Agent 类型定义
3. `packages/server/src/agent/context.ts` - Agent 上下文管理
4. `packages/server/src/tools/registry.ts` - 工具注册表

## 测试计划

1. 单元测试：Agent 循环逻辑
2. 单元测试：工具调用解析
3. 集成测试：端到端 Agent 对话
4. 手动测试：CLI Agent 模式

## 迭代里程碑

### Milestone 1: 基础 Agent

* [ ] 实现 Agent 类和 ReAct 循环

* [ ] 支持单次工具调用

* [ ] CLI 显示工具调用结果

### Milestone 2: 多轮工具调用

* [ ] 支持多轮工具调用直到完成

* [ ] 流式显示思考过程

* [ ] 错误处理和重试

### Milestone 3: 完善体验

* [ ] Web 界面支持 Agent 模式

* [ ] 工具调用可视化

* [ ] 会话中显示工具历史


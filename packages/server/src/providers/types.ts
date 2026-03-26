import type { Message } from '../session/types.js';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
  /** 启用扩展思考模式 */
  thinking?: {
    enabled: boolean;
    budget_tokens?: number;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
  tools?: ToolDefinition[];
  thinking?: {
    type: "enabled";
    budget_tokens?: number;
  };
}

/** 流式响应事件 */
export interface StreamChunk {
  type: 'content_delta' | 'thinking_delta' | 'tool_use' | 'done';
  delta?: string;
  toolUse?: { id: string; name: string; input: unknown };
  response?: ChatCompletionResponse;
}

export interface ChatCompletionResponse {
  content: string;
  thinking?: string;
  toolUses?: Array<{
    id: string;
    name: string;
    input: unknown;
  }>;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolParameter {
  type: string;
  description?: string;
  required?: boolean;
  enum?: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  contextLength?: number;
}

export interface ModelsResponse {
  models: ModelInfo[];
}

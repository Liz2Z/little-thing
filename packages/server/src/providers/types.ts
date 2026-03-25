import type { Message } from '../session/types.js';

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  stream?: boolean;
  max_tokens?: number;
  tools?: ToolDefinition[];
}

export interface ChatCompletionResponse {
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

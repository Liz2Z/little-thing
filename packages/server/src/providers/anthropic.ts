import type { LLMConfig, ChatCompletionRequest, ChatCompletionResponse, ToolDefinition } from './types.js';
import type { Message } from '../session/types.js';
import { InternalError, LlmErrors } from '../errors/index.js';
import { getProviderConfig, getCredentials, settings } from '../config';

export class AnthropicProvider {
  private config: LLMConfig;

  constructor(providerName: string = settings.llm.provider) {
    const config = getProviderConfig(providerName);
    const apiKey = getCredentials(providerName);

    if (!config) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    this.config = {
      ...config,
      apiKey: apiKey || '',
      model: settings.llm.model, // fallback to global default if needed
    };
  }



  async chatWithTools(
    messages: Message[],
    tools?: ToolDefinition[]
  ): Promise<ChatCompletionResponse> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      max_tokens: 4096,
      tools: tools ? this.convertToolsToAnthropicFormat(tools) as ToolDefinition[] : undefined,
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
      throw new InternalError(LlmErrors.API_ERROR, {
        status: response.status,
        response: error,
      });
    }

    const data = await response.json();

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
      stop_reason: data.stop_reason,
    };
  }

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

  private convertParameters(params: Record<string, { type: string; description?: string; enum?: string[] }>): Record<string, unknown> {
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

}

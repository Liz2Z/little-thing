import type { LLMConfig, ChatCompletionRequest, ChatCompletionResponse } from './types.js';
import type { Message } from '../session/types.js';

export class AnthropicProvider {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  async chat(messages: Message[]): Promise<ChatCompletionResponse> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      max_tokens: 4096,
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

    // 兼容智谱 GLM 格式
    const content = data.content?.[0]?.text || data?.message?.content || data?.choices?.[0]?.message?.content || '';

    return {
      content,
      usage: data.usage,
    };
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      stream: true,
      max_tokens: 4096,
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

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.delta?.text || '';
            if (delta) yield delta;
          } catch {
            // Ignore parse errors for incomplete chunks
          }
        }
      }
    }
  }
}

import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ToolDefinition,
  ProviderConfig,
  ModelsResponse,
  ModelInfo,
  StreamChunk,
} from "./types.js";
import type { Message } from "../session/types.js";
import { UnauthorizedError, InternalError, LlmErrors } from "../errors/index.js";
import { settings } from "../settings/index.js";

export class AnthropicProvider {
  private config: ProviderConfig & { apiKey: string; model: string };

  constructor() {
    // console.log(settings.llm.get());
    this.config = {
      baseUrl: settings.llm.baseUrl.get(),
      apiKey: settings.llm.apiKey.get(),
      model: settings.llm.model.get(),
      thinking: {
        enabled: settings.llm.thinkingEnabled.get(),
        budget_tokens: settings.llm.thinkingBudgetTokens?.get(),
      },
    };
  }

  async *chatWithTools(
    messages: Message[],
    tools?: ToolDefinition[],
    model?: string,
  ): AsyncGenerator<StreamChunk> {
    const requestBody: ChatCompletionRequest = {
      model: model || this.config.model,
      messages,
      max_tokens: 4096,
      stream: true,
      tools: tools
        ? (this.convertToolsToAnthropicFormat(tools) as ToolDefinition[])
        : undefined,
    };

    // 启用扩展思考模式
    if (this.config.thinking?.enabled) {
      requestBody.thinking = {
        type: "enabled",
        budget_tokens: this.config.thinking.budget_tokens,
      };
    }

    if (!this.config.apiKey) {
      throw new UnauthorizedError(LlmErrors.UNAUTHORIZED, {
        message: "API Key is missing. Please check your configuration.",
      });
    }

    if (!this.config.baseUrl) {
      throw new InternalError(LlmErrors.API_ERROR, {
        message: "Base URL is missing. Please check your configuration.",
      });
    }

    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }

      if (response.status === 401) {
        throw new UnauthorizedError(LlmErrors.UNAUTHORIZED, {
          status: 401,
          response: errorData,
        });
      }

      throw new InternalError(LlmErrors.API_ERROR, {
        status: response.status,
        response: errorData,
      });
    }

    if (!response.body) {
      throw new InternalError(LlmErrors.API_ERROR, {
        message: "Response body is empty",
      });
    }

    const content: string[] = [];
    const thinking: string[] = [];
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];
    let currentToolUse: { id?: string; name?: string; jsonBuffer: string } | null = null;
    let usage: { input_tokens: number; output_tokens: number } | undefined;
    let stopReason: string | undefined;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const json = JSON.parse(data);

            // 处理不同类型的流式事件
            if (json.type === "content_block_start") {
              if (json.content_block?.type === "thinking") {
                // 开始思考块
              } else if (json.content_block?.type === "tool_use") {
                currentToolUse = { id: json.content_block.id, name: json.content_block.name, jsonBuffer: "" };
              }
            } else if (json.type === "content_block_delta") {
              if (json.delta?.type === "thinking_delta") {
                const text = json.delta.thinking || "";
                thinking.push(text);
                yield { type: "thinking_delta", delta: text };
              } else if (json.delta?.type === "text_delta") {
                const text = json.delta.text || "";
                content.push(text);
                yield { type: "content_delta", delta: text };
              } else if (json.delta?.type === "input_json_delta" && currentToolUse) {
                currentToolUse.jsonBuffer += json.delta.partial_json || "";
              }
            } else if (json.type === "content_block_stop") {
              if (currentToolUse && currentToolUse.id && currentToolUse.name) {
                let input: unknown = {};
                try {
                  input = currentToolUse.jsonBuffer ? JSON.parse(currentToolUse.jsonBuffer) : {};
                } catch {
                  // JSON 解析失败，使用空对象
                }
                toolUses.push({
                  id: currentToolUse.id,
                  name: currentToolUse.name,
                  input,
                });
                yield { type: "tool_use", toolUse: toolUses[toolUses.length - 1] };
              }
              currentToolUse = null;
            } else if (json.type === "message_stop") {
              // 消息结束
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      // 获取最终的使用信息
      // 注意：Anthropic 流式API会在最后的message_start事件中发送usage信息
      // 这里我们假设usage信息在某个事件中，如果没有则使用默认值

      yield {
        type: "done",
        response: {
          content: content.join(""),
          thinking: thinking.length > 0 ? thinking.join("") : undefined,
          toolUses: toolUses.length > 0 ? toolUses : undefined,
          usage,
          stop_reason: stopReason,
        },
      };
    } finally {
      reader.releaseLock();
    }
  }

  private convertToolsToAnthropicFormat(tools: ToolDefinition[]): unknown[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: this.convertParameters(tool.parameters),
        required: Object.entries(tool.parameters)
          .filter(([, param]) => param.required)
          .map(([name]) => name),
      },
    }));
  }

  private convertParameters(
    params: Record<
      string,
      { type: string; description?: string; enum?: string[] }
    >,
  ): Record<string, unknown> {
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

  async getModels(): Promise<ModelsResponse> {
    if (!this.config.apiKey) {
      throw new UnauthorizedError(LlmErrors.UNAUTHORIZED, {
        message: "API Key is missing. Please check your configuration.",
      });
    }

    if (!this.config.baseUrl) {
      throw new InternalError(LlmErrors.API_ERROR, {
        message: "Base URL is missing. Please check your configuration.",
      });
    }

    const response = await fetch(`${this.config.baseUrl}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = errorText;
      }

      if (response.status === 401) {
        throw new UnauthorizedError(LlmErrors.UNAUTHORIZED, {
          status: 401,
          response: errorData,
        });
      }

      throw new InternalError(LlmErrors.API_ERROR, {
        status: response.status,
        response: errorData,
      });
    }

    const data = await response.json();

    // 处理不同的 API 响应格式
    let models: ModelInfo[] = [];

    // 标准 Anthropic/OpenAI 格式: { data: [{ id, name, ... }] }
    if (data.data && Array.isArray(data.data)) {
      models = data.data.map((model: unknown) => {
        if (typeof model === "object" && model !== null) {
          const m = model as Record<string, unknown>;
          return {
            id: (m.id as string) || (m.name as string) || "",
            name: (m.name as string) || (m.id as string) || "",
            displayName: m.display_name as string | undefined,
            description: m.description as string | undefined,
            contextLength: m.context_length as number | undefined,
          };
        }
        return { id: "", name: "" };
      });
    }
    // 智谱格式: { models: [{ id, name, ... }] } 或直接 { models: ["id1", "id2"] }
    else if (data.models) {
      if (Array.isArray(data.models)) {
        models = data.models.map((model: unknown) => {
          if (typeof model === "string") {
            return { id: model, name: model };
          }
          if (typeof model === "object" && model !== null) {
            const m = model as Record<string, unknown>;
            return {
              id: (m.id as string) || (m.name as string) || "",
              name: (m.name as string) || (m.id as string) || "",
              displayName: m.display_name as string | undefined,
              description: m.description as string | undefined,
              contextLength: m.context_length as number | undefined,
            };
          }
          return { id: "", name: "" };
        });
      }
    }

    return { models };
  }
}

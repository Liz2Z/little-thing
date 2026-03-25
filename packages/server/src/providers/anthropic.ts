import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ToolDefinition,
  ProviderConfig,
  ModelsResponse,
  ModelInfo,
} from "./types.js";
import type { Message } from "../session/types.js";
import { InternalError, LlmErrors } from "../errors/index.js";
import { settings } from "../settings/index.js";

export class AnthropicProvider {
  private config: ProviderConfig & { apiKey: string; model: string };

  constructor() {
    // console.log(settings.llm.get());
    this.config = {
      baseUrl: settings.llm.baseUrl.get(),
      apiKey: settings.llm.apiKey.get(),
      model: settings.llm.model.get(),
    };
  }

  async chatWithTools(
    messages: Message[],
    tools?: ToolDefinition[],
  ): Promise<ChatCompletionResponse> {
    const requestBody: ChatCompletionRequest = {
      model: this.config.model,
      messages,
      max_tokens: 4096,
      tools: tools
        ? (this.convertToolsToAnthropicFormat(tools) as ToolDefinition[])
        : undefined,
    };

    if (!this.config.apiKey) {
      throw new InternalError(LlmErrors.UNAUTHORIZED, {
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
        // Support some proxies that use Authorization header
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

      // Check for unauthorized specifically
      if (response.status === 401) {
        throw new InternalError(LlmErrors.UNAUTHORIZED, {
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

    // Handle common error formats in 200 OK responses
    // Standard Anthropic format
    if (data.error || data.type === "error") {
      throw new InternalError(LlmErrors.API_ERROR, {
        status: response.status,
        response: data.error || data,
      });
    }

    // Zhipu API format: {code: number, msg: string, success: boolean}
    if (data.code !== undefined && !data.success) {
      throw new InternalError(LlmErrors.API_ERROR, {
        status: data.code,
        response: {
          error: data.msg || data.message || "Unknown API error",
          code: data.code,
        },
      });
    }

    const content: string[] = [];
    const toolUses: Array<{ id: string; name: string; input: unknown }> = [];

    for (const item of data.content || []) {
      if (item.type === "text") {
        content.push(item.text);
      } else if (item.type === "tool_use") {
        toolUses.push({
          id: item.id,
          name: item.name,
          input: item.input,
        });
      }
    }

    return {
      content: content.join(""),
      toolUses: toolUses.length > 0 ? toolUses : undefined,
      usage: data.usage,
      stop_reason: data.stop_reason,
    };
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
      throw new InternalError(LlmErrors.UNAUTHORIZED, {
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
        throw new InternalError(LlmErrors.UNAUTHORIZED, {
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

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { InternalError, NotFoundError } from "../errors/base.js";
import modelsData from "./models.json";

class UnknownProviderError extends NotFoundError {
  constructor(details?: Record<string, unknown>) {
    super(["PROVIDER:UNKNOWN", 404, "Provider 不存在"] as const, details);
  }
}

class UnsupportedSDKError extends InternalError {
  constructor(details?: Record<string, unknown>) {
    super(
      ["PROVIDER:UNSUPPORTED_SDK", 500, "不支持的 SDK 类型"] as const,
      details,
    );
  }
}

class ProviderAPIError extends InternalError {
  constructor(details?: Record<string, unknown>) {
    super(
      ["PROVIDER:API_ERROR", 502, "Provider API 返回错误"] as const,
      details,
    );
  }
}

class MissingAPIKeyError extends InternalError {
  constructor(details?: Record<string, unknown>) {
    super(
      ["PROVIDER:MISSING_API_KEY", 500, "Provider API Key 未配置"] as const,
      details,
    );
  }
}

interface ProviderConfig {
  npm: string;
  api: string;
  env: string[];
}

/**
 * 根据 provider ID 和 model ID 创建 LanguageModel 实例
 * @param providerId - 供应商 ID（如 "zhipuai-coding-plan"）
 * @param modelId - 模型 ID（如 "glm-4.7"）
 * @returns LanguageModel 实例
 * @throws {NotFoundError} 当 provider 不存在时抛出错误
 * @throws {InternalError} 当 API key 缺失或 SDK 不支持时抛出错误
 */
export function createModel(providerId: string, modelId: string): any {
  const providerConfig = (modelsData as Record<string, ProviderConfig>)[
    providerId
  ];

  if (!providerConfig) {
    throw new UnknownProviderError({ providerId });
  }

  const apiKey = getApiKey(providerConfig.env);

  switch (providerConfig.npm) {
    case "@ai-sdk/anthropic": {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: providerConfig.api,
      });
      return anthropic(modelId);
    }

    case "@ai-sdk/openai": {
      const openai = createOpenAI({
        apiKey,
        baseURL: providerConfig.api,
      });
      return openai(modelId);
    }

    case "@ai-sdk/openai-compatible": {
      const compatible = createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL: providerConfig.api,
      });
      return compatible(modelId);
    }

    default:
      throw new UnsupportedSDKError({ npm: providerConfig.npm });
  }
}

/**
 * 获取 provider 支持的模型列表
 * @param providerId - 供应商 ID（如 "zhipuai-coding-plan"）
 * @returns 模型列表
 * @throws {NotFoundError} 当 provider 不存在时抛出错误
 * @throws {InternalError} 当 API key 缺失或 API 调用失败时抛出错误
 */
export async function listModels(
  providerId: string,
): Promise<Array<{ id: string; created?: number }>> {
  const providerConfig = (modelsData as Record<string, ProviderConfig>)[
    providerId
  ];

  if (!providerConfig) {
    throw new UnknownProviderError({ providerId });
  }

  const apiKey = getApiKey(providerConfig.env);

  try {
    const response = await fetch(`${providerConfig.api}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new ProviderAPIError({
        message: `Provider API returned error: ${response.status} ${response.statusText}`,
      });
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    if (error instanceof InternalError || error instanceof NotFoundError) {
      throw error;
    }
    throw new ProviderAPIError({
      message: `Failed to fetch models from provider: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * 从环境变量中获取 API Key
 * @param envNames - 环境变量名列表
 * @returns 第一个非空的环境变量值
 * @throws {InternalError} 当所有环境变量都为空时抛出错误
 */
function getApiKey(envNames: string[]): string {
  for (const name of envNames) {
    const key = process.env[name];
    if (key) return key;
  }
  throw new MissingAPIKeyError({ envNames });
}

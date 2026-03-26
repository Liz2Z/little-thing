import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { InternalError } from '../errors/index.js';
import { InternalErrors } from '../errors/codes.js';
import modelsData from './models.json';

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
 * @throws {InternalError} 当 provider 不存在或 API key 缺失时抛出错误
 */
export function createModel(providerId: string, modelId: string): any {
  const providerConfig = (modelsData as Record<string, ProviderConfig>)[providerId];

  if (!providerConfig) {
    throw new InternalError(InternalErrors.UNKNOWN_PROVIDER, {
      message: `Unknown provider: ${providerId}`,
    });
  }

  const apiKey = getApiKey(providerConfig.env);

  switch (providerConfig.npm) {
    case '@ai-sdk/anthropic': {
      const anthropic = createAnthropic({
        apiKey,
        baseURL: providerConfig.api,
      });
      return anthropic(modelId);
    }

    case '@ai-sdk/openai': {
      const openai = createOpenAI({
        apiKey,
        baseURL: providerConfig.api,
      });
      return openai(modelId);
    }

    case '@ai-sdk/openai-compatible': {
      const compatible = createOpenAICompatible({
        name: providerId,
        apiKey,
        baseURL: providerConfig.api,
      });
      return compatible(modelId);
    }

    default:
      throw new InternalError(InternalErrors.UNSUPPORTED_SDK, {
        message: `Unsupported SDK: ${providerConfig.npm}`,
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
  throw new InternalError(InternalErrors.MISSING_API_KEY, {
    message: `Missing API key. Set one of: ${envNames.join(', ')}`,
  });
}

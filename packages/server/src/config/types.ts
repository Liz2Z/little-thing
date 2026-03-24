import { z } from 'zod';
import {
  settingsSchema,
  providerSchema,
  credentialsSchema,
  llmSchema,
  serverSchema,
  loggingSchema,
} from './schema';

export type Settings = z.infer<typeof settingsSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;
export type LLMConfig = z.infer<typeof llmSchema>;
export type ServerConfig = z.infer<typeof serverSchema>;
export type LoggingConfig = z.infer<typeof loggingSchema>;

// 配置加载选项
export interface LoadSettingsOptions {
  globalPath?: string; // 默认: ~/.config/littlething/settings.json
  projectPath?: string; // 默认: {项目目录}/settings.json
  credentialsPath?: string; // 默认: ~/.config/littlething/credentials
  cliArgs?: Record<string, unknown>; // 命令行参数
  errorHandling?: 'strict' | 'warn' | 'fallback'; // 错误处理策略，默认: strict
}

// Add Provider 选项
export interface AddProviderOptions {
  validateUrl?: boolean; // 是否验证 URL 可达性，默认: false
  checkCredentials?: boolean; // 是否检查 credentials 中存在对应的 key，默认: true
}

// 模型列表获取
export interface ProviderModelsFetcher {
  // 获取模型列表
  fetchModels(baseUrl: string, apiKey: string): Promise<string[]>;

  // 检查 Provider 是否支持模型列表 API
  isSupported(baseUrl: string): boolean;
}

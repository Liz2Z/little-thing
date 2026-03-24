import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { Settings, LoadSettingsOptions } from './types';
import { settingsSchema } from './schema';
import { ValidationError, ConfigError } from './errors';

/**
 * 深度合并两个对象
 */
function deepMerge<T>(target: any, source: any): T {
  if (!source) return target;
  if (!target) return source;

  const result = { ...target };

  for (const key of Object.keys(source)) {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(sourceValue)) {
      result[key] = sourceValue;
    } else if (sourceValue && typeof sourceValue === 'object') {
      result[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * 查找项目配置目录
 */
function findProjectConfigPath(): string | undefined {
  const cwd = process.cwd();
  const paths = [
    join(cwd, '.littlething', 'settings.json'),
    join(cwd, 'settings.json'),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * 获取默认全局配置路径
 */
function getDefaultGlobalPath(): string {
  return join(homedir(), '.config', 'littlething', 'settings.json');
}

/**
 * 从环境变量中解析配置 (前缀为 LITTLETHING_)
 */
function loadEnvConfig(): Partial<Settings> {
  const config: any = {};

  // 这里实现具体映射逻辑，简化起见，我们主要处理一些常见的
  if (process.env.LITTLETHING_SERVER_PORT) {
    config.server = config.server || {};
    config.server.port = parseInt(process.env.LITTLETHING_SERVER_PORT, 10);
  }
  if (process.env.LITTLETHING_SERVER_HOST) {
    config.server = config.server || {};
    config.server.host = process.env.LITTLETHING_SERVER_HOST;
  }
  if (process.env.LITTLETHING_LLM_PROVIDER) {
    config.llm = config.llm || {};
    config.llm.provider = process.env.LITTLETHING_LLM_PROVIDER;
  }
  if (process.env.LITTLETHING_LLM_MODEL) {
    config.llm = config.llm || {};
    config.llm.model = process.env.LITTLETHING_LLM_MODEL;
  }

  return config;
}

/**
 * 加载并解析配置文件
 */
function loadConfigFile(path: string): Partial<Settings> {
  if (!existsSync(path)) return {};

  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[Config] Failed to load config file: ${path}`);
    return {};
  }
}

/**
 * 合并并验证配置
 */
export function mergeAndValidateSettings(
  configs: Partial<Settings>[],
  options: LoadSettingsOptions = {}
): Settings {
  let merged: any = {};
  for (const config of configs) {
    merged = deepMerge(merged, config);
  }

  try {
    return settingsSchema.parse(merged);
  } catch (error: any) {
    const strategy = options.errorHandling || 'strict';
    const message = `Invalid settings: ${error.message}`;

    if (strategy === 'strict') {
      throw new ValidationError(message);
    }

    if (strategy === 'warn') {
      console.warn(`[Config] ${message}. Using defaults for invalid fields.`);
    }

    // fallback 逻辑: 使用默认值
    return settingsSchema.parse({});
  }
}

/**
 * 执行完整的加载流程
 */
export async function performLoadSettings(
  options: LoadSettingsOptions = {}
): Promise<Settings> {
  const globalPath = options.globalPath || getDefaultGlobalPath();
  const projectPath = options.projectPath || findProjectConfigPath();

  const configs: Partial<Settings>[] = [];

  // 1. 全局配置 (最低优先级)
  configs.push(loadConfigFile(globalPath));

  // 2. 项目配置
  if (projectPath) {
    configs.push(loadConfigFile(projectPath));
  }

  // 3. 环境变量
  configs.push(loadEnvConfig());

  // 4. CLI 参数 (最高优先级)
  if (options.cliArgs) {
    configs.push(options.cliArgs as Partial<Settings>);
  }

  const settings = mergeAndValidateSettings(configs, options);
  return settings;
}

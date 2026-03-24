import {
  Settings,
  ProviderConfig,
  LoadSettingsOptions,
  Credentials,
  AddProviderOptions,
} from './types';
import { performLoadSettings } from './loader';
import {
  loadCredentials,
  getDefaultCredentialsPath,
  ensureCredentialsPermissions,
} from './credentials';
import { providerSchema, settingsSchema } from './schema';
import { ValidationError, CredentialsError } from './errors';

let _settings: Settings | null = null;
let _credentials: Credentials | null = null;
let _customProviders: Record<string, ProviderConfig> = {};

/**
 * 检查配置是否已加载
 */
export function isSettingsLoaded(): boolean {
  return !!_settings;
}

/**
 * 重新加载配置
 */
export async function reloadSettings(options?: LoadSettingsOptions): Promise<void> {
  await loadSettings(options);
}

/**
 * 加载配置
 */
export async function loadSettings(options: LoadSettingsOptions = {}): Promise<void> {
  // 加载 Settings
  _settings = await performLoadSettings(options);

  // 加载 Credentials
  const credentialsPath =
    options.credentialsPath || getDefaultCredentialsPath();
  await ensureCredentialsPermissions(credentialsPath);
  _credentials = loadCredentials(credentialsPath);

  // 合并 settings 中的 customProviders
  _customProviders = { ...(_settings?.customProviders || {}) };
}

/**
 * 只读配置对象
 */
export const settings: Readonly<Settings> = new Proxy({} as Settings, {
  get(_, prop: string) {
    if (!_settings) {
      throw new Error('Settings not loaded. Call loadSettings() first.');
    }
    return (_settings as any)[prop];
  },
});

/**
 * 获取指定 Provider 配置
 */
export function getProviderConfig(name: string): ProviderConfig | undefined {
  if (!_settings) {
    throw new Error('Settings not loaded. Call loadSettings() first.');
  }

  // 1. 检查内置 Providers
  const builtInConfig = _settings.providers[name];
  if (builtInConfig) return builtInConfig;

  // 2. 检查自定义 Providers (配置中的)
  const settingsCustomConfig = _settings.customProviders[name];
  if (settingsCustomConfig) return settingsCustomConfig;

  // 3. 检查运行时添加的 Providers
  return _customProviders[name];
}

/**
 * 获取默认 Provider 配置
 */
export function getDefaultProviderConfig(): ProviderConfig {
  if (!_settings) {
    throw new Error('Settings not loaded. Call loadSettings() first.');
  }

  const defaultProvider = _settings.llm.provider;
  const config = getProviderConfig(defaultProvider);

  if (!config) {
    // 如果没有找到配置，尝试使用 llm 顶层的配置作为后备
    const fallbackConfig: ProviderConfig = {
      baseUrl: _settings.llm.baseUrl || 'https://api.openai.com/v1',
      timeout: _settings.llm.timeout || 30000,
      maxRetries: _settings.llm.maxRetries || 3,
    };
    return fallbackConfig;
  }

  return config;
}

/**
 * 获取 Provider 的 API Key
 */
export function getCredentials(providerName: string): string | undefined {
  if (!_credentials) {
    throw new Error('Credentials not loaded. Call loadSettings() first.');
  }

  // 1. 检查内置的 Providers 凭据
  const key = _credentials.providers[providerName];
  if (key) return key;

  // 2. 检查自定义 Providers 凭据
  return _credentials.customProviders[providerName];
}

/**
 * 添加自定义 Provider (运行时，不持久化)
 */
export function addCustomProvider(
  name: string,
  config: ProviderConfig,
  options?: AddProviderOptions
): void {
  // Schema 验证
  try {
    providerSchema.parse(config);
  } catch (error: any) {
    throw new ValidationError(`Invalid provider config: ${error.message}`);
  }

  // 名称冲突检查 (这里我们允许覆盖 runtime Providers, 但不覆盖配置好的)
  if (_settings?.providers[name] || _settings?.customProviders[name]) {
    console.warn(`[Config] Overriding configured provider: ${name}`);
  }

  // 检查 API Key 是否存在
  if (options?.checkCredentials !== false) {
    const key = getCredentials(name);
    if (!key) {
      throw new CredentialsError(`Credentials for provider ${name} not found.`);
    }
  }

  _customProviders[name] = config;
}

/**
 * 验证配置
 */
export function validateSettings(data: unknown): Settings {
  return settingsSchema.parse(data);
}

// 导出类型
export * from './types';
export { ConfigError, ValidationError, CredentialsError } from './errors';

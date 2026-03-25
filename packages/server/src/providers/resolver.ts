import { settingsConfig, credentialsConfig } from '../config';
import { ProviderConfig, Settings, Credentials } from '../config/schemas';
import { ProviderNotFoundError, CredentialsError } from '../config/errors';

export interface ResolvedProvider extends ProviderConfig {
  apiKey: string;
  model: string;
}

let _customProviders: Record<string, ProviderConfig> = {};

function getSettings(): Settings {
  const settings = settingsConfig.getRaw();
  if (!settings) {
    throw new Error('Config not loaded');
  }
  return settings;
}

function getCredentials(): Credentials {
  const credentials = credentialsConfig.getRaw();
  if (!credentials) {
    throw new Error('Credentials not loaded');
  }
  return credentials;
}

function getProviderConfig(name: string): ProviderConfig | undefined {
  const settings = getSettings();
  return settings.providers[name] ?? settings.customProviders[name] ?? _customProviders[name];
}

function getProviderCredentials(providerName: string): string | undefined {
  const credentials = getCredentials();
  return credentials.providers[providerName] ?? credentials.customProviders[providerName];
}

export function resolveProvider(name?: string): ResolvedProvider {
  const settings = getSettings();
  const providerName = name ?? settings.llm.provider;
  const providerConfig = getProviderConfig(providerName);

  if (!providerConfig) {
    throw new ProviderNotFoundError(providerName);
  }

  const apiKey = getProviderCredentials(providerName);
  if (!apiKey) {
    throw new CredentialsError(`Credentials for provider ${providerName} not found`);
  }

  return {
    ...providerConfig,
    apiKey,
    model: settings.llm.model,
  };
}

export function hasProvider(name: string): boolean {
  return !!getProviderConfig(name);
}

export function addCustomProvider(name: string, config: ProviderConfig): void {
  _customProviders[name] = config;
}

export function getLlmConfig() {
  return getSettings().llm;
}

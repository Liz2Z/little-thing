import { Config } from './core';
import { settingsSchema, credentialsSchema } from './schemas';
import { getDefaultCredentialsPath, ensureCredentialsPermissions } from './credentials';

export * from './core';
export * from './schemas';
export * from './errors';

export const settingsConfig = new Config('littlething', settingsSchema);
export const credentialsConfig = new Config('littlething-credentials', credentialsSchema, {
  globalPath: getDefaultCredentialsPath(),
});

export async function loadConfig(): Promise<void> {
  settingsConfig.load();
  await ensureCredentialsPermissions(getDefaultCredentialsPath());
  credentialsConfig.load();
}

export function reloadConfig(): Promise<void> {
  return loadConfig();
}

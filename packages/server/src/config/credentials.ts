import { chmod, existsSync, readFileSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { credentialsSchema } from './schema';
import { Credentials } from './types';
import { expandEnvVar } from './env';
import { CredentialsError } from './errors';

const RECOMMENDED_PERMISSIONS = 0o600;

/**
 * 确保 credentials 文件权限正确 (仅所有者可读写)
 */
export async function ensureCredentialsPermissions(path: string): Promise<void> {
  if (existsSync(path)) {
    try {
      await new Promise<void>((resolve, reject) => {
        chmod(path, RECOMMENDED_PERMISSIONS, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      console.warn(`[Config] Failed to set permissions for credentials file: ${path}`);
    }
  }
}

/**
 * 读取并解析 credentials 文件，展开其中的环境变量
 */
export function loadCredentials(path: string): Credentials {
  if (!existsSync(path)) {
    return { providers: {}, customProviders: {} };
  }

  try {
    const rawContent = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(rawContent);
    const validated = credentialsSchema.parse(parsed);

    // 展开所有 apiKey 里的环境变量
    const providers: Record<string, string> = {};
    for (const [name, key] of Object.entries(validated.providers)) {
      providers[name] = expandEnvVar(key);
    }

    const customProviders: Record<string, string> = {};
    for (const [name, key] of Object.entries(validated.customProviders)) {
      customProviders[name] = expandEnvVar(key);
    }

    return { providers, customProviders };
  } catch (error: any) {
    if (error.name === 'ZodError') {
      throw new CredentialsError(`Invalid credentials format: ${error.message}`);
    }
    throw new CredentialsError(`Failed to load credentials: ${error.message}`);
  }
}

/**
 * 保存 credentials 到文件
 */
export async function saveCredentials(
  path: string,
  credentials: Credentials
): Promise<void> {
  const content = JSON.stringify(credentials, null, 2);
  await writeFile(path, content, { mode: RECOMMENDED_PERMISSIONS });
}

/**
 * 获取默认的 credentials 路径 (~/.config/littlething/credentials)
 */
export function getDefaultCredentialsPath(): string {
  return join(homedir(), '.config', 'littlething', 'credentials');
}

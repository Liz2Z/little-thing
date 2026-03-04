import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const CONFIG_DIR = join(homedir(), '.config', 'agent-cli');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DATA_DIR = join(homedir(), '.local', 'share', 'agent-cli');

export interface CliConfig {
  serverUrl: string;
  apiKey?: string;
  model?: string;
  dataDir: string;
  activeSessionId?: string;
}

const defaultConfig: CliConfig = {
  serverUrl: 'http://localhost:3000',
  model: 'glm-4.7',
  dataDir: DATA_DIR,
};

export function loadConfig(): CliConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { ...defaultConfig };
  }

  try {
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    const saved = JSON.parse(content);
    return { ...defaultConfig, ...saved };
  } catch {
    return { ...defaultConfig };
  }
}

export function saveConfig(config: Partial<CliConfig>): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const current = loadConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

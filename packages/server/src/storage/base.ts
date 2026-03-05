import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const DEFAULT_DATA_DIR = join(homedir(), '.local', 'share', 'littlething');
const DEFAULT_CONFIG_DIR = join(homedir(), '.config', 'littlething');

export type StorageCategory = 'data' | 'config' | 'cache';

export function getBaseDir(category: StorageCategory = 'data'): string {
  switch (category) {
    case 'config':
      return DEFAULT_CONFIG_DIR;
    case 'cache':
      return join(homedir(), '.cache', 'littlething');
    case 'data':
    default:
      return DEFAULT_DATA_DIR;
  }
}

export function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function resolvePath(
  filename: string,
  category: StorageCategory = 'data',
  subDir?: string
): string {
  const base = getBaseDir(category);
  const dir = subDir ? join(base, subDir) : base;
  ensureDir(dir);
  return join(dir, filename);
}

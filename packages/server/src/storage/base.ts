import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { xdgData, xdgConfig, xdgCache } from 'xdg-basedir';
import { InternalError } from '../errors/base.js';

const APP_NAME = 'littlething';

class XDGDirNotAvailableError extends InternalError {
  constructor(category: string) {
    super(['STORAGE:XDG_DIR_NOT_AVAILABLE', 500, `XDG ${category} 目录不可用`] as const, { category });
  }
}

export type StorageCategory = 'data' | 'config' | 'cache';

export function getBaseDir(category: StorageCategory = 'data'): string {
  const base = category === 'config' ? xdgConfig
    : category === 'cache' ? xdgCache
    : xdgData;

  if (!base) {
    throw new XDGDirNotAvailableError(category);
  }

  return join(base, APP_NAME);
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

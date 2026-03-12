import { readFileSync, appendFileSync, existsSync, unlinkSync, writeFileSync } from 'fs';
import type { IJsonlStore } from './types.js';
import { resolvePath, type StorageCategory } from './base.js';

export class JsonlStore<T> implements IJsonlStore<T> {
  private filePath: string;

  constructor(
    filename: string,
    options: { category?: StorageCategory; subDir?: string } = {}
  ) {
    const { category = 'data', subDir } = options;
    this.filePath = resolvePath(filename, category, subDir);
  }

  loadAll(): T[] {
    if (!existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = readFileSync(this.filePath, 'utf-8');
      return content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => JSON.parse(line));
    } catch {
      return [];
    }
  }

  append(item: T): void {
    const line = JSON.stringify(item) + '\n';
    appendFileSync(this.filePath, line);
  }

  clear(): void {
    writeFileSync(this.filePath, '');
  }

  exists(): boolean {
    return existsSync(this.filePath);
  }

  delete(): boolean {
    if (!existsSync(this.filePath)) {
      return false;
    }
    try {
      unlinkSync(this.filePath);
      return true;
    } catch {
      return false;
    }
  }

  getPath(): string {
    return this.filePath;
  }

  loadRange(start: number, end?: number): T[] {
    const all = this.loadAll();
    if (end === undefined) {
      return all.slice(start);
    }
    return all.slice(start, end);
  }

  truncate(count: number): boolean {
    if (!existsSync(this.filePath)) {
      return false;
    }
    try {
      const all = this.loadAll();
      const truncated = all.slice(0, count);
      const content = truncated.map(item => JSON.stringify(item)).join('\n') + (truncated.length > 0 ? '\n' : '');
      writeFileSync(this.filePath, content);
      return true;
    } catch {
      return false;
    }
  }

  overwrite(items: T[]): void {
    const content = items.map(item => JSON.stringify(item)).join('\n') + (items.length > 0 ? '\n' : '');
    writeFileSync(this.filePath, content);
  }
}

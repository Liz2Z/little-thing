import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolvePath, type StorageCategory } from "./base.js";
import type { IJsonStore, JsonStorageOptions } from "./types.js";

export class JsonStore<T> implements IJsonStore<T> {
  private filePath: string;
  private defaultValue: T;
  private pretty: boolean;

  constructor(
    filename: string,
    defaultValue: T,
    options: JsonStorageOptions & {
      category?: StorageCategory;
      subDir?: string;
    } = {},
  ) {
    const { category = "data", subDir, pretty = true } = options;
    this.filePath = resolvePath(filename, category, subDir);
    this.defaultValue = defaultValue;
    this.pretty = pretty;
  }

  load(): T {
    if (!existsSync(this.filePath)) {
      return this.defaultValue;
    }
    try {
      const content = readFileSync(this.filePath, "utf-8");
      return JSON.parse(content);
    } catch {
      return this.defaultValue;
    }
  }

  save(data: T): void {
    const content = this.pretty
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    writeFileSync(this.filePath, content);
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
}

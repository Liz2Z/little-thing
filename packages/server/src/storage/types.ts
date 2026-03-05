export interface StorageOptions {
  baseDir?: string;
}

export interface JsonStorageOptions extends StorageOptions {
  pretty?: boolean;
}

export interface JsonlStorageOptions extends StorageOptions {}

export interface IJsonStore<T> {
  load(): T;
  save(data: T): void;
  exists(): boolean;
  delete(): boolean;
  getPath(): string;
}

export interface IJsonlStore<T> {
  loadAll(): T[];
  append(item: T): void;
  clear(): void;
  exists(): boolean;
  delete(): boolean;
  getPath(): string;
}

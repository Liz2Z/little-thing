import { z } from 'zod';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { xdgConfig } from 'xdg-basedir';
import { homedir } from 'os';
import { ConfigError, ValidationError } from './errors';

type ZodObjectLike = z.ZodObject<any>;
type Infer<T extends ZodObjectLike> = z.infer<T>;

export interface ConfigOptions {
  globalPath?: string;
  projectPath?: string;
  envPrefix?: string;
  errorHandling?: 'strict' | 'warn' | 'fallback';
}

function deepMerge<T>(target: any, source: any): T {
  if (!source) return target;
  if (!target) return source;

  const result = { ...target };

  for (const key of Object.keys(source)) {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(sourceValue)) {
      result[key] = sourceValue;
    } else if (sourceValue && typeof sourceValue === 'object') {
      result[key] = deepMerge(targetValue || {}, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

function findProjectConfigPath(appName: string): string | undefined {
  const cwd = process.cwd();
  const paths = [
    join(cwd, `.${appName}`, 'settings.json'),
    join(cwd, 'settings.json'),
  ];

  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  return undefined;
}

function getDefaultGlobalPath(appName: string): string {
  const configDir = xdgConfig ?? join(homedir(), '.config');
  return join(configDir, appName, 'settings.json');
}

function loadConfigFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};

  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    console.warn(`[Config] Failed to load config file: ${path}`);
    return {};
  }
}

function loadEnvConfig(prefix: string): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const envPrefix = prefix.toUpperCase() + '_';

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(envPrefix) || value === undefined) continue;

    const configPath = key.slice(envPrefix.length).toLowerCase().split('_');
    let current: Record<string, unknown> = config;

    for (let i = 0; i < configPath.length - 1; i++) {
      const segment = configPath[i];
      if (!(segment in current)) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[configPath[configPath.length - 1]] = value;
  }

  return config;
}

type LeafAccessor<T> = {
  get(): T;
  set(value: T): void;
};

type ObjectAccessor<T> = {
  get(): T;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
} & {
  [K in keyof T]: T[K] extends object
    ? ObjectAccessor<T[K]> & LeafAccessor<T[K]>
    : LeafAccessor<T[K]>;
};

function createAccessor<T extends object>(
  data: T,
  path: string[],
  onChange: () => void
): ObjectAccessor<T> {
  const accessor: any = {
    get(key?: keyof T) {
      if (key === undefined) {
        return { ...data };
      }
      return data[key];
    },
    set(key: keyof T, value: T[keyof T]) {
      (data as any)[key] = value;
      onChange();
    },
  };

  for (const key of Object.keys(data)) {
    Object.defineProperty(accessor, key, {
      get() {
        const value = data[key as keyof T];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return createAccessor(
            value as object,
            [...path, key],
            onChange
          );
        }
        return {
          get: () => value,
          set: (newValue: any) => {
            (data as any)[key] = newValue;
            onChange();
          },
        };
      },
      enumerable: true,
      configurable: true,
    });
  }

  return accessor;
}

export class Config<T extends ZodObjectLike> {
  private schema: T;
  private appName: string;
  private options: ConfigOptions;
  private data: Infer<T> | null = null;
  private globalPath: string;
  private projectPath: string | undefined;

  constructor(appName: string, schema: T, options: ConfigOptions = {}) {
    this.appName = appName;
    this.schema = schema;
    this.options = options;
    this.globalPath = options.globalPath ?? getDefaultGlobalPath(appName);
    this.projectPath = options.projectPath ?? findProjectConfigPath(appName);
  }

  load(): ObjectAccessor<Infer<T>> {
    const configs: Partial<Infer<T>>[] = [];

    configs.push(loadConfigFile(this.globalPath) as Partial<Infer<T>>);

    if (this.projectPath) {
      configs.push(loadConfigFile(this.projectPath) as Partial<Infer<T>>);
    }

    const envPrefix = this.options.envPrefix ?? this.appName;
    configs.push(loadEnvConfig(envPrefix) as Partial<Infer<T>>);

    this.data = this.merge(...configs);

    return createAccessor(this.data!, [], () => {
      this.save();
    });
  }

  merge(...configs: Partial<Infer<T>>[]): Infer<T> {
    let merged: any = {};
    for (const config of configs) {
      if (config && Object.keys(config).length > 0) {
        merged = deepMerge(merged, config);
      }
    }

    try {
      return this.schema.parse(merged);
    } catch (error: any) {
      const strategy = this.options.errorHandling || 'strict';
      const message = `Invalid settings: ${error.message}`;

      if (strategy === 'strict') {
        throw new ValidationError(message);
      }

      if (strategy === 'warn') {
        console.warn(`[Config] ${message}. Using defaults for invalid fields.`);
      }

      return this.schema.parse({});
    }
  }

  validate(data: unknown): Infer<T> {
    try {
      return this.schema.parse(data);
    } catch (error: any) {
      throw new ValidationError(`Validation failed: ${error.message}`);
    }
  }

  save(): void {
    if (!this.data) {
      throw new ConfigError('No data to save. Call load() first.');
    }

    const dir = dirname(this.globalPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(this.globalPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getRaw(): Infer<T> | null {
    return this.data;
  }
}

export type { ObjectAccessor, LeafAccessor };

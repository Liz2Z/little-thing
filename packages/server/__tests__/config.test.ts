import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Config } from '../src/config/core';
import { z } from 'zod';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../src/config/errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Config Core', () => {
  const testBaseDir = join(__dirname, '__test_config__');
  const configDir = join(testBaseDir, 'config');
  const configPath = join(configDir, 'settings.json');

  const testSchema = z.object({
    name: z.string().default('test'),
    server: z.object({
      port: z.coerce.number().default(3000),
      host: z.string().default('localhost'),
    }).default({ port: 3000, host: 'localhost' }),
    features: z.object({
      enabled: z.coerce.boolean().default(false),
      level: z.coerce.number().default(1),
    }).default({ enabled: false, level: 1 }),
  });

  beforeEach(async () => {
    await mkdir(configDir, { recursive: true });
    
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('TESTAPP_')) {
        delete process.env[key];
      }
    }
  });

  afterEach(async () => {
    await rm(testBaseDir, { recursive: true, force: true });
  });

  describe('Schema Validation', () => {
    it('should validate correct settings', () => {
      const config = new Config('testapp', testSchema, { globalPath: configPath });
      const validated = config.validate({
        name: 'myapp',
        server: { port: 4000, host: '127.0.0.1' },
        features: { enabled: true, level: 5 },
      });
      expect(validated.server.port).toBe(4000);
      expect(validated.features.enabled).toBe(true);
    });

    it('should throw ValidationError for invalid data', () => {
      const config = new Config('testapp', testSchema, { globalPath: configPath });
      expect(() => config.validate({
        server: { port: 'not-a-number' }
      })).toThrow();
    });

    it('should apply defaults for missing fields', () => {
      const config = new Config('testapp', testSchema, { globalPath: configPath });
      const validated = config.validate({});
      expect(validated.name).toBe('test');
      expect(validated.server.port).toBe(3000);
      expect(validated.features.enabled).toBe(false);
    });
  });

  describe('Load and Access', () => {
    it('should load from file and provide accessors', async () => {
      await writeFile(configPath, JSON.stringify({
        name: 'loaded-app',
        server: { port: 8080 },
      }));

      const config = new Config('testapp', testSchema, { globalPath: configPath });
      const settings = config.load();

      expect(settings.get('name')).toBe('loaded-app');
      expect(settings.server.get('port')).toBe(8080);
      expect(settings.server.get('host')).toBe('localhost');
    });

    it('should support nested get/set', async () => {
      const config = new Config('testapp', testSchema, { globalPath: configPath });
      const settings = config.load();

      expect(settings.features.get('enabled')).toBe(false);
      settings.features.enabled.set(true);
      expect(settings.features.get('enabled')).toBe(true);

      settings.features.set('level', 10);
      expect(settings.features.get('level')).toBe(10);
    });
  });

  describe('Merge', () => {
    it('should merge multiple configs deeply', () => {
      const config = new Config('testapp', testSchema, { globalPath: configPath });
      
      const merged = config.merge(
        { name: 'base', server: { port: 3000, host: 'localhost' } },
        { server: { port: 4000 } },
        { features: { enabled: true } }
      );

      expect(merged.name).toBe('base');
      expect(merged.server.port).toBe(4000);
      expect(merged.server.host).toBe('localhost');
      expect(merged.features.enabled).toBe(true);
      expect(merged.features.level).toBe(1);
    });
  });

  describe('Environment Variables', () => {
    it('should load from env with prefix', async () => {
      process.env.TESTAPP_NAME = 'env-app';
      process.env.TESTAPP_SERVER_PORT = '9000';

      const config = new Config('testapp', testSchema, { 
        globalPath: configPath,
        envPrefix: 'TESTAPP',
      });
      const settings = config.load();

      expect(settings.get('name')).toBe('env-app');
      expect(settings.server.get('port')).toBe(9000);
    });
  });

  describe('Error Handling', () => {
    it('should throw in strict mode for invalid config', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { port: 'invalid' },
      }));

      const config = new Config('testapp', testSchema, { 
        globalPath: configPath,
        errorHandling: 'strict',
      });

      expect(() => config.load()).toThrow(ValidationError);
    });

    it('should fallback to defaults in fallback mode', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { port: 'invalid' },
      }));

      const config = new Config('testapp', testSchema, { 
        globalPath: configPath,
        errorHandling: 'fallback',
      });
      const settings = config.load();

      expect(settings.server.get('port')).toBe(3000);
    });
  });
});

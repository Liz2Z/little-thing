import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Settings } from '../../src/settings/core';
import { z } from 'zod';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../../src/settings/errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Settings Core', () => {
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
    providers: z.record(z.string(), z.object({
      apiKey: z.string(),
    })).default({}),
    customProviders: z.record(z.string(), z.object({
      apiKey: z.string(),
    })).default({}),
  });

  beforeEach(async () => {
    await mkdir(configDir, { recursive: true });

    // Clean up environment variables
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('TESTAPP_')) {
        delete process.env[key];
      }
    }
    process.env.EXPAND_TEST = 'expanded-value';
  });

  afterEach(async () => {
    await rm(testBaseDir, { recursive: true, force: true });
    delete process.env.EXPAND_TEST;
  });

  describe('Schema Validation', () => {
    it('should apply defaults for missing fields', () => {
      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const accessor = settingsManager.load();
      expect(accessor.get('name')).toBe('test');
      expect(accessor.server.get('port')).toBe(3000);
      expect(accessor.features.get('enabled')).toBe(false);
    });
  });

  describe('Load and Access', () => {
    it('should load from file and provide accessors', async () => {
      await writeFile(configPath, JSON.stringify({
        name: 'loaded-app',
        server: { port: 8080 },
      }));

      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      expect(settings.get('name')).toBe('loaded-app');
      expect(settings.server.get('port')).toBe(8080);
      expect(settings.server.get('host')).toBe('localhost');
    });

    it('should support nested get/set', async () => {
      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      expect(settings.features.get('enabled')).toBe(false);
      settings.features.enabled.set(true);
      expect(settings.features.get('enabled')).toBe(true);

      settings.features.set('level', 10);
      expect(settings.features.get('level')).toBe(10);
    });

    it('should support watch at different levels', async () => {
      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      let rootChanged = false;
      let featuresChanged = false;
      let enabledChanged = false;

      settings.watch(() => { rootChanged = true; });
      settings.features.watch(() => { featuresChanged = true; });
      settings.features.enabled.watch(() => { enabledChanged = true; });

      settings.features.enabled.set(true);

      expect(rootChanged).toBe(true);
      expect(featuresChanged).toBe(true);
      expect(enabledChanged).toBe(true);
    });

    it('should allow setting the whole object', async () => {
      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      settings.server.set({ port: 9999, host: '0.0.0.0' });
      expect(settings.server.get('port')).toBe(9999);
      expect(settings.server.get('host')).toBe('0.0.0.0');
    });
  });

  describe('Configuration Layers & Merging', () => {
    const globalPath = join(testBaseDir, 'global.json');
    const localPath = join(testBaseDir, 'local.json');
    const credentialsPath = join(testBaseDir, 'credentials.json');

    it('should favor CLI args over environment variables', async () => {
      process.env.TESTAPP_NAME = 'env-app';
      const originalArgv = process.argv;
      process.argv = [...originalArgv, '--testapp-name=cli-app'];

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath, projectPath: localPath, envPrefix: 'TESTAPP'
      });
      const settings = settingsManager.load();

      expect(settings.get('name')).toBe('cli-app');
      process.argv = originalArgv;
    });

    it('should favor environment variables over local config', async () => {
      process.env.TESTAPP_SERVER_PORT = '9000';
      await writeFile(localPath, JSON.stringify({ server: { port: 8080 } }));

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath, projectPath: localPath, envPrefix: 'TESTAPP'
      });
      const settings = settingsManager.load();

      expect(settings.server.get('port')).toBe(9000);
    });

    it('should favor local config over global config', async () => {
      await writeFile(localPath, JSON.stringify({ server: { port: 8080 } }));
      await writeFile(globalPath, JSON.stringify({ server: { port: 7070 } }));

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath, projectPath: localPath
      });
      const settings = settingsManager.load();

      expect(settings.server.get('port')).toBe(8080);
    });

    it('should load credentials and map to providers', async () => {
      await writeFile(credentialsPath, JSON.stringify({
        providers: {
          openai: 'sk-12345',
          anthropic: 'sk-anthropic',
        },
        customProviders: {
          myllm: 'sk-custom',
        }
      }));

      const settingsManager = new Settings('testapp', testSchema, {
        credentialsPath
      });
      const settings = settingsManager.load();

      expect(settings.providers.get('openai')).toEqual({ apiKey: 'sk-12345' });
      expect(settings.providers.get('anthropic')).toEqual({ apiKey: 'sk-anthropic' });
      expect(settings.customProviders.get('myllm')).toEqual({ apiKey: 'sk-custom' });
    });
  });

  describe('Environment Variable Expansion', () => {
    it('should expand environment variables in strings', async () => {
      process.env.DYNAMIC_HOST = 'remote-host';
      await writeFile(configPath, JSON.stringify({
        server: { host: '${DYNAMIC_HOST}' }
      }));

      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      expect(settings.server.get('host')).toBe('remote-host');
      delete process.env.DYNAMIC_HOST;
    });

    it('should support default values in expansion', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { host: '${UNDEFINED_HOST:-localhost}' }
      }));

      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      expect(settings.server.get('host')).toBe('localhost');
    });

    it('should support escaping with $$', async () => {
      await writeFile(configPath, JSON.stringify({
        name: '$$escaped'
      }));

      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      const settings = settingsManager.load();

      expect(settings.get('name')).toBe('$escaped');
    });

    it('should throw CredentialsError for missing env var without default', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { host: '${NON_EXISTENT_VAR}' }
      }));

      const settingsManager = new Settings('testapp', testSchema, { globalPath: configPath });
      expect(() => settingsManager.load()).toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw ValidationError in strict mode for invalid config', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { port: 'invalid' },
      }));

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath: configPath,
        errorHandling: 'strict',
      });

      expect(() => settingsManager.load()).toThrow(ValidationError);
    });

    it('should fallback to defaults in default mode (warn/fallback)', async () => {
      await writeFile(configPath, JSON.stringify({
        server: { port: 'invalid' },
      }));

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath: configPath,
      });
      const settings = settingsManager.load();

      expect(settings.server.get('port')).toBe(3000);
    });

    it('should warn when errorHandling is set to warn (implicit check of console.warn)', async () => {
      const warnSpy = { called: false };
      const originalWarn = console.warn;
      console.warn = () => { warnSpy.called = true; };

      await writeFile(configPath, JSON.stringify({
        server: { port: 'invalid' },
      }));

      const settingsManager = new Settings('testapp', testSchema, {
        globalPath: configPath,
        errorHandling: 'warn',
      });
      settingsManager.load();

      expect(warnSpy.called).toBe(true);
      console.warn = originalWarn;
    });
  });
});

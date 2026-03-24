import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { 
  loadSettings, 
  settings, 
  getProviderConfig, 
  getDefaultProviderConfig, 
  getCredentials, 
  addCustomProvider,
  validateSettings,
  isSettingsLoaded,
  reloadSettings
} from '../src/config/index';
import { mkdir, writeFile, rm, chmod } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ValidationError, CredentialsError } from '../src/config/errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Config System', () => {
  const testBaseDir = join(__dirname, '__test_config__');
  const globalConfigDir = join(testBaseDir, 'global');
  const projectConfigDir = join(testBaseDir, 'project');
  
  const globalSettingsPath = join(globalConfigDir, 'settings.json');
  const projectSettingsPath = join(projectConfigDir, 'settings.json');
  const credentialsPath = join(globalConfigDir, 'credentials');

  beforeEach(async () => {
    await mkdir(globalConfigDir, { recursive: true });
    await mkdir(projectConfigDir, { recursive: true });
    
    // Clear env vars
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('LITTLETHING_')) {
        delete process.env[key];
      }
    }
    delete process.env.TEST_API_KEY;
  });

  afterEach(async () => {
    await rm(testBaseDir, { recursive: true, force: true });
  });

  describe('Schema Validation', () => {
    it('should validate correct settings', () => {
      const validData = {
        llm: { provider: 'zhipu', model: 'glm-4' },
        server: { port: 3000, host: 'localhost' },
        logging: { level: 'info', format: 'text' },
        ui: {}
      };
      const validated = validateSettings(validData);
      expect(validated.server.port).toBe(3000);
    });

    it('should throw ValidationError for invalid data', () => {
      const invalidData = {
        server: { port: 'not-a-number' }
      };
      expect(() => validateSettings(invalidData)).toThrow();
    });
  });

  describe('Layered Loading', () => {
    it('should merge global, project, env and cli configs correctly', async () => {
      // 1. Global config
      await writeFile(globalSettingsPath, JSON.stringify({
        llm: { provider: 'global-p', model: 'global-m' },
        server: { port: 3000, host: 'localhost' }
      }));

      // 2. Project config (overrides global)
      await writeFile(projectSettingsPath, JSON.stringify({
        llm: { provider: 'project-p' },
        server: { port: 4000 }
      }));

      // 3. Env config (overrides project)
      process.env.LITTLETHING_SERVER_PORT = '5000';

      // 4. CLI config (highest priority)
      const cliArgs = {
        llm: { model: 'cli-m' }
      };

      await loadSettings({
        globalPath: globalSettingsPath,
        projectPath: projectSettingsPath,
        credentialsPath: credentialsPath,
        cliArgs: cliArgs
      });

      expect(settings.server.port).toBe(5000); // From Env
      expect(settings.server.host).toBe('localhost'); // From Global
      expect(settings.llm.provider).toBe('project-p'); // From Project
      expect(settings.llm.model).toBe('cli-m'); // From CLI
    });

    it('should support deep merge for customProviders', async () => {
      await writeFile(globalSettingsPath, JSON.stringify({
        customProviders: {
          p1: { baseUrl: 'http://p1.com' }
        }
      }));

      await writeFile(projectSettingsPath, JSON.stringify({
        customProviders: {
          p2: { baseUrl: 'http://p2.com' }
        }
      }));

      await loadSettings({
        globalPath: globalSettingsPath,
        projectPath: projectSettingsPath,
        credentialsPath: credentialsPath
      });

      expect((settings.customProviders as any)['p1']?.baseUrl).toBe('http://p1.com');
      expect((settings.customProviders as any)['p2']?.baseUrl).toBe('http://p2.com');
    });
  });

  describe('Credentials Loading', () => {
    it('should expand environment variables in credentials', async () => {
      process.env.TEST_API_KEY = 'secret-123';
      
      await writeFile(credentialsPath, JSON.stringify({
        providers: {
          zhipu: '${TEST_API_KEY}',
          anthropic: '${NON_EXISTENT:-fallback-key}'
        },
        customProviders: {
          'my-p': 'direct-key'
        }
      }));

      await loadSettings({
        globalPath: globalSettingsPath,
        credentialsPath: credentialsPath
      });

      expect(getCredentials('zhipu')).toBe('secret-123');
      expect(getCredentials('anthropic')).toBe('fallback-key');
      expect(getCredentials('my-p')).toBe('direct-key');
    });

    it('should throw error for missing mandatory env var', async () => {
      await writeFile(credentialsPath, JSON.stringify({
        providers: {
          zhipu: '${MISSING_VAR}'
        },
        customProviders: {}
      }));

      try {
        await loadSettings({
          globalPath: globalSettingsPath,
          credentialsPath: credentialsPath
        });
        expect(true).toBe(false); // Should not reach here
      } catch (error: any) {
        expect(error).toBeInstanceOf(CredentialsError);
        expect(error.message).toContain('Environment variable not found: MISSING_VAR');
      }
    });
  });

  describe('Provider Management', () => {
    beforeEach(async () => {
       await writeFile(globalSettingsPath, JSON.stringify({
        llm: { provider: 'zhipu', model: 'glm-4' },
        providers: {
          zhipu: { baseUrl: 'http://zhipu.com' }
        }
      }));
      await writeFile(credentialsPath, JSON.stringify({
        providers: { zhipu: 'key1', runtime: 'key2' },
        customProviders: {}
      }));
      await loadSettings({
        globalPath: globalSettingsPath,
        credentialsPath: credentialsPath
      });
    });

    it('should find provider in built-in providers', () => {
      const config = getProviderConfig('zhipu');
      expect(config?.baseUrl).toBe('http://zhipu.com');
    });

    it('should add and find runtime custom provider', () => {
      addCustomProvider('runtime', { 
        baseUrl: 'http://runtime.com',
        timeout: 30000,
        maxRetries: 3
      });
      const config = getProviderConfig('runtime');
      expect(config?.baseUrl).toBe('http://runtime.com');
    });

    it('should throw error if adding runtime provider without credentials', () => {
      expect(() => {
        addCustomProvider('no-key', { 
          baseUrl: 'http://nokey.com',
          timeout: 30000,
          maxRetries: 3
        });
      }).toThrow(CredentialsError);
    });

    it('should get default provider config', () => {
      const config = getDefaultProviderConfig();
      expect(config.baseUrl).toBe('http://zhipu.com');
    });
  });

  describe('Error Handling Strategies', () => {
    it('should throw in strict mode for invalid config', async () => {
      await writeFile(globalSettingsPath, JSON.stringify({
        server: { port: 'invalid' }
      }));

      expect(loadSettings({
        globalPath: globalSettingsPath,
        errorHandling: 'strict'
      })).rejects.toThrow(ValidationError);
    });

    it('should fallback to defaults in fallback mode', async () => {
      await writeFile(globalSettingsPath, JSON.stringify({
        server: { port: 'invalid' }
      }));

      await loadSettings({
        globalPath: globalSettingsPath,
        errorHandling: 'fallback'
      });

      expect(settings.server.port).toBe(3000); // Default value from schema
    });
  });
});

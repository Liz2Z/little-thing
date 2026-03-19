import { describe, it, expect } from 'bun:test';
import { loadConfig, saveConfig, getConfigPath, getDataDir } from '../../src/config.js';

describe('CLI Config', () => {
  it('should load default config', () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.serverUrl).toBe('http://localhost:3000');
    expect(config.dataDir).toBeDefined();
  });

  it('should get config path', () => {
    const path = getConfigPath();
    expect(path).toBeDefined();
    expect(typeof path).toBe('string');
    expect(path.length).toBeGreaterThan(0);
  });

  it('should get data dir', () => {
    const dir = getDataDir();
    expect(dir).toBeDefined();
    expect(typeof dir).toBe('string');
    expect(dir.length).toBeGreaterThan(0);
  });

  it('should have expected default values', () => {
    const config = loadConfig();
    expect(config.serverUrl).toContain('http');
    expect(config.dataDir).toContain('littlething');
  });
});

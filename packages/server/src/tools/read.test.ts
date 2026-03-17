import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createReadTool } from './read.js';
import { getTextContent } from './types.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('read tool', () => {
  const testDir = join(import.meta.dir, '__test_read__');
  const testFile = join(testDir, 'test.txt');
  const readTool = createReadTool(testDir);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    await writeFile(testFile, content);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should read entire file', async () => {
    const result = await readTool.execute('test-id', { path: 'test.txt' });
    const text = getTextContent(result);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 100');
  });

  it('should read file with offset (1-indexed)', async () => {
    const result = await readTool.execute('test-id', { path: 'test.txt', offset: 50 });
    const text = getTextContent(result);
    expect(text).toContain('Line 50');
    expect(text).toContain('Line 100');
    expect(text).not.toMatch(/^Line 1\b/);
  });

  it('should read file with limit', async () => {
    const result = await readTool.execute('test-id', { path: 'test.txt', limit: 10 });
    const text = getTextContent(result);
    expect(text).toContain('Line 1');
    expect(text).toContain('Line 10');
    expect(text).not.toContain('Line 11');
  });

  it('should read file with offset and limit', async () => {
    const result = await readTool.execute('test-id', { path: 'test.txt', offset: 20, limit: 5 });
    const text = getTextContent(result);
    expect(text).toContain('Line 20');
    expect(text).toContain('Line 24');
    expect(text).not.toContain('Line 19');
    expect(text).not.toContain('Line 25');
  });

  it('should return error for non-existent file', async () => {
    try {
      await readTool.execute('test-id', { path: '/non/existent/file.txt' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toBeDefined();
    }
  });

  it('should return error for directory path', async () => {
    try {
      await readTool.execute('test-id', { path: '.' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toBeDefined();
    }
  });
});

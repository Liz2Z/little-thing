import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { read } from './read.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('read tool', () => {
  const testDir = join(import.meta.dir, '__test_read__');
  const testFile = join(testDir, 'test.txt');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    const content = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    await writeFile(testFile, content);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should read entire file', async () => {
    const result = await read({ file_path: testFile });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 1');
    expect(result.output).toContain('Line 100');
  });

  it('should read file with offset', async () => {
    const result = await read({ file_path: testFile, offset: 50 });
    expect(result.success).toBe(true);
    expect(result.output).not.toContain('1→Line 1');
    expect(result.output).toContain('51→Line 51');
  });

  it('should read file with limit', async () => {
    const result = await read({ file_path: testFile, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 1');
    expect(result.output).toContain('Line 10');
    expect(result.output).not.toContain('Line 11');
  });

  it('should read file with offset and limit', async () => {
    const result = await read({ file_path: testFile, offset: 20, limit: 5 });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Line 21');
    expect(result.output).toContain('Line 25');
    expect(result.output).not.toContain('Line 20');
    expect(result.output).not.toContain('Line 26');
  });

  it('should return error for non-existent file', async () => {
    const result = await read({ file_path: '/non/existent/file.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should return error for directory path', async () => {
    const result = await read({ file_path: testDir });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a file');
  });

  it('should format output with line numbers', async () => {
    const result = await read({ file_path: testFile, limit: 3 });
    expect(result.success).toBe(true);
    const lines = result.output!.split('\n');
    expect(lines[0]).toMatch(/^\s*1→/);
    expect(lines[1]).toMatch(/^\s*2→/);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ls } from './ls.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('ls tool', () => {
  const testDir = join(import.meta.dir, '__test_ls__');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'file1.txt'), 'content1');
    await writeFile(join(testDir, 'file2.ts'), 'content2');
    await mkdir(join(testDir, 'subdir'));
    await writeFile(join(testDir, 'subdir', 'file3.js'), 'content3');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should list files and directories', async () => {
    const result = await ls({ path: testDir });
    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).toContain('file2.ts');
    expect(result.output).toContain('subdir');
  });

  it('should return error for non-existent path', async () => {
    const result = await ls({ path: '/non/existent/path' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should return error for file path instead of directory', async () => {
    const result = await ls({ path: join(testDir, 'file1.txt') });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not a directory');
  });

  it('should format output with correct structure', async () => {
    const result = await ls({ path: testDir });
    expect(result.success).toBe(true);
    const lines = result.output!.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some(line => line.includes('file1.txt'))).toBe(true);
    expect(lines.some(line => line.includes('subdir') && line.startsWith('-'))).toBe(true);
  });
});

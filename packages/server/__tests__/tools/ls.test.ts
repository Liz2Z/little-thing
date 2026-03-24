import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createLsTool } from '../../src/tools/ls.js';
import { getTextContent } from '../../src/tools/types.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('ls tool', () => {
  const testDir = join(__dirname, '__test_ls__');
  const lsTool = createLsTool(testDir);

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
    const result = await lsTool.execute('test-id', { path: '.' });
    const text = getTextContent(result);
    expect(text).toContain('file1.txt');
    expect(text).toContain('file2.ts');
    expect(text).toContain('subdir/');
  });

  it('should return error for non-existent path', async () => {
    try {
      await lsTool.execute('test-id', { path: '/non/existent/path' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe('TOOL-1001');
    }
  });

  it('should return error for file path instead of directory', async () => {
    try {
      await lsTool.execute('test-id', { path: 'file1.txt' });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.code).toBe('TOOL-1007');
    }
  });

  it('should format output with correct structure', async () => {
    const result = await lsTool.execute('test-id', { path: '.' });
    const text = getTextContent(result);
    const lines = text.split('\n');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((line: string) => line.includes('file1.txt'))).toBe(true);
    expect(lines.some((line: string) => line.includes('subdir/'))).toBe(true);
  });
});

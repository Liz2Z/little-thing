import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createGrepTool } from '../../src/tools/grep.js';
import { getTextContent } from '../../src/tools/types.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hasRipgrep = (() => {
  try {
    const { execSync } = require('child_process');
    execSync('which rg', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasRipgrep)('grep tool', () => {
  const testDir = join(__dirname, '__test_grep__');
  const grepTool = createGrepTool(testDir);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(join(testDir, 'file1.txt'), 'Hello World\nhello universe\nHELLO there');
    await writeFile(join(testDir, 'file2.ts'), 'const hello = "world";\nfunction sayHello() {}');
    await mkdir(join(testDir, 'subdir'));
    await writeFile(join(testDir, 'subdir', 'file3.txt'), 'Hello from subdir');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should find matches in files', async () => {
    const result = await grepTool.execute('test-id', {
      pattern: 'Hello',
      path: '.',
    });
    const text = getTextContent(result);
    expect(text).toContain('file1.txt');
    expect(text).toContain('file2.ts');
  });

  it('should search case-insensitively with ignoreCase flag', async () => {
    const result = await grepTool.execute('test-id', {
      pattern: 'hello',
      path: '.',
      ignoreCase: true,
    });
    const text = getTextContent(result);
    expect(text).toContain('file1.txt');
    expect(text).toContain('file2.ts');
    expect(text).toContain('file3.txt');
  });

  it('should filter by glob pattern', async () => {
    const result = await grepTool.execute('test-id', {
      pattern: 'Hello',
      path: '.',
      glob: '*.txt',
    });
    const text = getTextContent(result);
    expect(text).toContain('file1.txt');
    expect(text).not.toContain('file2.ts');
  });

  it('should return content with line numbers', async () => {
    const result = await grepTool.execute('test-id', {
      pattern: 'Hello',
      path: 'file1.txt',
    });
    const text = getTextContent(result);
    expect(text).toContain(':1:');
    expect(text).toContain('Hello World');
  });

  it('should return empty result when no matches found', async () => {
    const result = await grepTool.execute('test-id', {
      pattern: 'nonexistentpattern12345',
      path: '.',
    });
    const text = getTextContent(result);
    expect(text).toContain('No matches found');
  });

  it('should return error for non-existent path', async () => {
    try {
      await grepTool.execute('test-id', {
        pattern: 'test',
        path: '/non/existent/path',
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('not found');
    }
  });
});

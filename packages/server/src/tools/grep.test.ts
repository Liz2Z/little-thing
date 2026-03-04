import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { grep } from './grep.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';

describe('grep tool', () => {
  const testDir = join(import.meta.dir, '__test_grep__');

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
    const result = await grep({
      pattern: 'Hello',
      path: testDir,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).toContain('file2.ts');
  });

  it('should search case-insensitively with -i flag', async () => {
    const result = await grep({
      pattern: 'hello',
      path: testDir,
      '-i': true,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).toContain('file2.ts');
    expect(result.output).toContain('file3.txt');
  });

  it('should filter by glob pattern', async () => {
    const result = await grep({
      pattern: 'Hello',
      path: testDir,
      glob: '*.txt',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('file1.txt');
    expect(result.output).not.toContain('file2.ts');
  });

  it('should return content with -n flag', async () => {
    const result = await grep({
      pattern: 'Hello',
      path: join(testDir, 'file1.txt'),
      '-n': true,
      output_mode: 'content',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('1:');
    expect(result.output).toContain('Hello World');
  });

  it('should return files_with_matches by default', async () => {
    const result = await grep({
      pattern: 'Hello',
      path: testDir,
    });
    expect(result.success).toBe(true);
    const lines = result.output!.split('\n').filter(l => l.trim());
    expect(lines.every(line => !line.includes(':'))).toBe(true);
  });

  it('should return count with output_mode=count', async () => {
    const result = await grep({
      pattern: 'hello',
      path: testDir,
      '-i': true,
      output_mode: 'count',
    });
    expect(result.success).toBe(true);
    expect(result.output).toMatch(/\d+/);
  });

  it('should show context with -C flag', async () => {
    const result = await grep({
      pattern: 'hello universe',
      path: join(testDir, 'file1.txt'),
      '-C': 1,
      output_mode: 'content',
      '-n': true,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello World');
    expect(result.output).toContain('hello universe');
    expect(result.output).toContain('HELLO there');
  });

  it('should return error for non-existent path', async () => {
    const result = await grep({
      pattern: 'test',
      path: '/non/existent/path',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should return empty result when no matches found', async () => {
    const result = await grep({
      pattern: 'nonexistentpattern12345',
      path: testDir,
    });
    expect(result.success).toBe(true);
    expect(result.output).toBe('');
  });
});

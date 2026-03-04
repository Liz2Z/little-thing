import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { write } from './write.js';
import { mkdir, rm, readFile, stat, writeFile } from 'fs/promises';
import { join } from 'path';

describe('write tool', () => {
  const testDir = join(import.meta.dir, '__test_write__');
  const testFile = join(testDir, 'test.txt');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create a new file', async () => {
    const result = await write({
      file_path: testFile,
      content: 'Hello World',
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('Hello World');
  });

  it('should overwrite existing file', async () => {
    await writeFile(testFile, 'Old content');
    
    const result = await write({
      file_path: testFile,
      content: 'New content',
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('New content');
  });

  it('should create nested directories if needed', async () => {
    const nestedFile = join(testDir, 'subdir', 'nested', 'file.txt');
    const result = await write({
      file_path: nestedFile,
      content: 'Nested content',
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(nestedFile, 'utf-8');
    expect(content).toBe('Nested content');
  });

  it('should write multi-line content', async () => {
    const multiLineContent = 'Line 1\nLine 2\nLine 3';
    const result = await write({
      file_path: testFile,
      content: multiLineContent,
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe(multiLineContent);
  });

  it('should return error when trying to write to a directory', async () => {
    const result = await write({
      file_path: testDir,
      content: 'content',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('is a directory');
  });

  it('should return success message with file path', async () => {
    const result = await write({
      file_path: testFile,
      content: 'content',
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain(testFile);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createWriteTool } from './write.js';
import { getTextContent } from './types.js';
import { mkdir, rm, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

describe('write tool', () => {
  const testDir = join(import.meta.dir, '__test_write__');
  const testFile = join(testDir, 'test.txt');
  const writeTool = createWriteTool(testDir);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create a new file', async () => {
    const result = await writeTool.execute('test-id', {
      path: 'test.txt',
      content: 'Hello World',
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully wrote');

    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('Hello World');
  });

  it('should overwrite existing file', async () => {
    await writeFile(testFile, 'Old content');

    const result = await writeTool.execute('test-id', {
      path: 'test.txt',
      content: 'New content',
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully wrote');

    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('New content');
  });

  it('should create nested directories if needed', async () => {
    const nestedFile = join(testDir, 'subdir', 'nested', 'file.txt');
    const nestedTool = createWriteTool(testDir);
    const result = await nestedTool.execute('test-id', {
      path: 'subdir/nested/file.txt',
      content: 'Nested content',
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully wrote');

    const content = await readFile(nestedFile, 'utf-8');
    expect(content).toBe('Nested content');
  });

  it('should write multi-line content', async () => {
    const multiLineContent = 'Line 1\nLine 2\nLine 3';
    const result = await writeTool.execute('test-id', {
      path: 'test.txt',
      content: multiLineContent,
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully wrote');

    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe(multiLineContent);
  });
});

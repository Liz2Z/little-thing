import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { edit } from './edit.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('edit tool', () => {
  const testDir = join(import.meta.dir, '__test_edit__');
  const testFile = join(testDir, 'test.txt');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(testFile, 'Hello World\nThis is a test\nGoodbye World');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should replace text in file', async () => {
    const result = await edit({
      file_path: testFile,
      old_str: 'Hello World',
      new_str: 'Hi World',
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(testFile, 'utf-8');
    expect(content).toContain('Hi World');
    expect(content).not.toContain('Hello World');
  });

  it('should replace multi-line text', async () => {
    const result = await edit({
      file_path: testFile,
      old_str: 'Hello World\nThis is a test',
      new_str: 'New Line 1\nNew Line 2',
    });
    expect(result.success).toBe(true);
    
    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('New Line 1\nNew Line 2\nGoodbye World');
  });

  it('should return error if old_str not found', async () => {
    const result = await edit({
      file_path: testFile,
      old_str: 'Non-existent text',
      new_str: 'Replacement',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should return error if old_str appears multiple times', async () => {
    await writeFile(testFile, 'repeat\nrepeat\nrepeat');
    const result = await edit({
      file_path: testFile,
      old_str: 'repeat',
      new_str: 'once',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('appears 3 times');
  });

  it('should return error for non-existent file', async () => {
    const result = await edit({
      file_path: '/non/existent/file.txt',
      old_str: 'old',
      new_str: 'new',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });

  it('should return error when old_str equals new_str', async () => {
    const result = await edit({
      file_path: testFile,
      old_str: 'Hello World',
      new_str: 'Hello World',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('must be different');
  });
});

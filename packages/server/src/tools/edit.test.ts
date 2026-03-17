import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createEditTool } from './edit.js';
import { getTextContent } from './types.js';
import { mkdir, writeFile, rm, readFile } from 'fs/promises';
import { join } from 'path';

describe('edit tool', () => {
  const testDir = join(import.meta.dir, '__test_edit__');
  const testFile = join(testDir, 'test.txt');
  const editTool = createEditTool(testDir);

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(testFile, 'Hello World\nThis is a test\nGoodbye World');
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should replace text in file', async () => {
    const result = await editTool.execute('test-id', {
      path: 'test.txt',
      oldText: 'Hello World',
      newText: 'Hi World',
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully replaced');

    const content = await readFile(testFile, 'utf-8');
    expect(content).toContain('Hi World');
    expect(content).not.toContain('Hello World');
  });

  it('should replace multi-line text', async () => {
    const result = await editTool.execute('test-id', {
      path: 'test.txt',
      oldText: 'Hello World\nThis is a test',
      newText: 'New Line 1\nNew Line 2',
    });
    const text = getTextContent(result);
    expect(text).toContain('Successfully replaced');

    const content = await readFile(testFile, 'utf-8');
    expect(content).toBe('New Line 1\nNew Line 2\nGoodbye World');
  });

  it('should return error if oldText not found', async () => {
    try {
      await editTool.execute('test-id', {
        path: 'test.txt',
        oldText: 'Non-existent text',
        newText: 'Replacement',
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Could not find');
    }
  });

  it('should return error if oldText appears multiple times', async () => {
    await writeFile(testFile, 'repeat\nrepeat\nrepeat');
    try {
      await editTool.execute('test-id', {
        path: 'test.txt',
        oldText: 'repeat',
        newText: 'once',
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('occurrences');
    }
  });

  it('should return error for non-existent file', async () => {
    try {
      await editTool.execute('test-id', {
        path: '/non/existent/file.txt',
        oldText: 'old',
        newText: 'new',
      });
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('not found');
    }
  });
});

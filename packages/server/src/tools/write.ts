import { stat, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { ToolResult, WriteParams } from './types.js';

export async function write(params: WriteParams): Promise<ToolResult> {
  try {
    try {
      const stats = await stat(params.file_path);
      if (stats.isDirectory()) {
        return {
          success: false,
          error: `Error: ${params.file_path} is a directory`,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    const dir = dirname(params.file_path);
    await mkdir(dir, { recursive: true });

    await writeFile(params.file_path, params.content, 'utf-8');

    return {
      success: true,
      output: `Successfully wrote to ${params.file_path}`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error: ${error}`,
    };
  }
}

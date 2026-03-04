import { readdir, stat } from 'fs/promises';
import { join, basename } from 'path';
import type { ToolResult, LsParams } from './types.js';

export async function ls(params: LsParams): Promise<ToolResult> {
  try {
    const stats = await stat(params.path);
    
    if (!stats.isDirectory()) {
      return {
        success: false,
        error: `Error: ${params.path} is not a directory`,
      };
    }

    const entries = await readdir(params.path, { withFileTypes: true });
    const lines: string[] = [];

    for (const entry of entries) {
      const fullPath = join(params.path, entry.name);
      const isDir = entry.isDirectory();
      const prefix = isDir ? '-' : ' ';
      lines.push(`${prefix} ${fullPath}`);
    }

    lines.sort();

    return {
      success: true,
      output: lines.join('\n'),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: `Error: ${params.path} does not exist`,
      };
    }
    return {
      success: false,
      error: `Error: ${error}`,
    };
  }
}

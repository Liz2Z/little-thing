import { stat, readFile } from 'fs/promises';
import type { ToolResult, ReadParams } from './types.js';

export async function read(params: ReadParams): Promise<ToolResult> {
  try {
    const stats = await stat(params.file_path);
    
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Error: ${params.file_path} is not a file`,
      };
    }

    const content = await readFile(params.file_path, 'utf-8');
    const lines = content.split('\n');
    
    const offset = params.offset ?? 0;
    const limit = params.limit ?? lines.length;
    
    const selectedLines = lines.slice(offset, offset + limit);
    
    const maxLineNum = Math.min(offset + limit, lines.length);
    const maxLineNumWidth = String(maxLineNum).length;
    
    const formattedLines = selectedLines.map((line, index) => {
      const lineNum = offset + index + 1;
      const paddedLineNum = String(lineNum).padStart(maxLineNumWidth);
      return `${paddedLineNum}→${line}`;
    });

    return {
      success: true,
      output: formattedLines.join('\n'),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        success: false,
        error: `Error: ${params.file_path} does not exist`,
      };
    }
    return {
      success: false,
      error: `Error: ${error}`,
    };
  }
}

import { stat, readFile, writeFile } from 'fs/promises';
import type { ToolResult, EditParams } from './types.js';

export async function edit(params: EditParams): Promise<ToolResult> {
  try {
    if (params.old_str === params.new_str) {
      return {
        success: false,
        error: 'Error: old_str and new_str must be different',
      };
    }

    const stats = await stat(params.file_path);
    
    if (!stats.isFile()) {
      return {
        success: false,
        error: `Error: ${params.file_path} is not a file`,
      };
    }

    const content = await readFile(params.file_path, 'utf-8');
    
    const occurrences = content.split(params.old_str).length - 1;
    
    if (occurrences === 0) {
      return {
        success: false,
        error: `Error: old_str not found in ${params.file_path}`,
      };
    }

    if (occurrences > 1) {
      return {
        success: false,
        error: `Error: old_str appears ${occurrences} times in ${params.file_path}. Please provide a unique string.`,
      };
    }

    const newContent = content.replace(params.old_str, params.new_str);
    await writeFile(params.file_path, newContent, 'utf-8');

    return {
      success: true,
      output: `Successfully edited ${params.file_path}`,
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

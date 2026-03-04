import { ls } from './ls.js';
import { read } from './read.js';
import { edit } from './edit.js';
import { write } from './write.js';
import { grep } from './grep.js';
import type { ToolDefinition, ToolParams, ToolResult, ToolName } from './types.js';

export { ls, read, edit, write, grep };
export type { ToolDefinition, ToolParams, ToolResult, ToolName };

export const toolDefinitions: Record<ToolName, ToolDefinition> = {
  ls: {
    name: 'ls',
    description: 'Lists files and directories in a given path. Returns the list with directory indicator.',
    parameters: {
      path: {
        type: 'string',
        description: 'The absolute path to the directory to list',
        required: true,
      },
    },
  },
  read: {
    name: 'read',
    description: 'Reads a file from the local filesystem. Can read specific line ranges with offset and limit.',
    parameters: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to read',
        required: true,
      },
      offset: {
        type: 'number',
        description: 'The number of lines to skip before reading',
        required: false,
      },
      limit: {
        type: 'number',
        description: 'The number of lines to read',
        required: false,
      },
    },
  },
  edit: {
    name: 'edit',
    description: 'Performs exact string replacements in files. The old_str must appear exactly once.',
    parameters: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to edit',
        required: true,
      },
      old_str: {
        type: 'string',
        description: 'The text to search for - must match exactly',
        required: true,
      },
      new_str: {
        type: 'string',
        description: 'The text to replace old_str with',
        required: true,
      },
    },
  },
  write: {
    name: 'write',
    description: 'Writes content to a file, creating it if it does not exist. Overwrites existing content.',
    parameters: {
      file_path: {
        type: 'string',
        description: 'The absolute path to the file to write',
        required: true,
      },
      content: {
        type: 'string',
        description: 'The content to write to the file',
        required: true,
      },
    },
  },
  grep: {
    name: 'grep',
    description: 'Searches for patterns in files using regular expressions. Supports various output modes.',
    parameters: {
      pattern: {
        type: 'string',
        description: 'The regular expression pattern to search for',
        required: true,
      },
      path: {
        type: 'string',
        description: 'The directory or file to search in',
        required: false,
      },
      glob: {
        type: 'string',
        description: 'Glob pattern to filter files (e.g., "*.ts")',
        required: false,
      },
      output_mode: {
        type: 'string',
        description: 'Output format: files_with_matches, content, or count',
        enum: ['files_with_matches', 'content', 'count'],
        required: false,
      },
      '-i': {
        type: 'boolean',
        description: 'Case insensitive search',
        required: false,
      },
      '-n': {
        type: 'boolean',
        description: 'Show line numbers in output',
        required: false,
      },
      '-C': {
        type: 'number',
        description: 'Number of context lines to show around matches',
        required: false,
      },
    },
  },
};

export async function executeTool(name: ToolName, params: ToolParams): Promise<ToolResult> {
  switch (name) {
    case 'ls':
      return ls(params as Parameters<typeof ls>[0]);
    case 'read':
      return read(params as Parameters<typeof read>[0]);
    case 'edit':
      return edit(params as Parameters<typeof edit>[0]);
    case 'write':
      return write(params as Parameters<typeof write>[0]);
    case 'grep':
      return grep(params as Parameters<typeof grep>[0]);
    default:
      return {
        success: false,
        error: `Unknown tool: ${name}`,
      };
  }
}

export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(toolDefinitions);
}

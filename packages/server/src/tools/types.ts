export type ToolName = 'ls' | 'read' | 'edit' | 'write' | 'grep';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  name: ToolName;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface LsParams {
  path: string;
}

export interface ReadParams {
  file_path: string;
  offset?: number;
  limit?: number;
}

export interface EditParams {
  file_path: string;
  old_str: string;
  new_str: string;
}

export interface WriteParams {
  file_path: string;
  content: string;
}

export interface GrepParams {
  pattern: string;
  path?: string;
  glob?: string;
  output_mode?: 'files_with_matches' | 'content' | 'count';
  '-i'?: boolean;
  '-n'?: boolean;
  '-C'?: number;
}

export type ToolParams = LsParams | ReadParams | EditParams | WriteParams | GrepParams;

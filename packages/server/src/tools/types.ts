import type { ZodType } from 'zod';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string;
  mimeType: string;
}

export interface ToolExecutionResult<TDetails = any> {
  content: (TextContent | ImageContent)[];
  details?: TDetails;
}

export interface ToolDefinition<T extends ZodType = ZodType, TDetails = any> {
  name: string;
  label: string;
  description: string;
  parameters: T;
  execute: (
    toolCallId: string,
    params: T['_output'],
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult<TDetails>>;
}

export interface AnyTool {
  name: string;
  label: string;
  description: string;
  parameters: ZodType;
  execute: (
    toolCallId: string,
    params: any,
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult<any>>;
}

export type ToolName = 'ls' | 'read' | 'edit' | 'write' | 'grep';

export function isTextContent(content: TextContent | ImageContent): content is TextContent {
  return content.type === 'text';
}

export function getTextContent(result: ToolExecutionResult): string {
  const textContent = result.content.find(isTextContent);
  return textContent?.text ?? '';
}

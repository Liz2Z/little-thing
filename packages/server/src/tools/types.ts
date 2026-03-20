import type { Static, TSchema } from '@sinclair/typebox';

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

export interface ToolDefinition<TParameters extends TSchema = TSchema, TDetails = any> {
  name: string;
  label: string;
  description: string;
  parameters: TParameters;
  execute: (
    toolCallId: string,
    params: Static<TParameters>,
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult<TDetails>>;
}

export interface AnyTool {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
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

export function toolToProviderFormat(tool: AnyTool): {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
  }>;
} {
  const properties: Record<string, { type: string; description?: string; required?: boolean }> = {};
  const required: string[] = [];
  
  const params = tool.parameters.properties as Record<string, { type: string; description?: string }>;
  
  for (const [key, value] of Object.entries(params)) {
    properties[key] = {
      type: value.type || 'string',
      description: value.description,
    };
  }
  
  const requiredFields = tool.parameters.required as string[] | undefined;
  if (requiredFields) {
    required.push(...requiredFields);
  }
  
  return {
    name: tool.name,
    description: tool.description,
    parameters: properties,
  };
}

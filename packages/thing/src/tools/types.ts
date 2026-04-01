import type { ZodType } from "zod";
import { z } from "zod";

export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});
export type TextContent = z.infer<typeof TextContentSchema>;

export const ImageContentSchema = z.object({
  type: z.literal("image"),
  data: z.string(),
  mimeType: z.string(),
});
export type ImageContent = z.infer<typeof ImageContentSchema>;

export const ToolContentSchema = z.union([
  TextContentSchema,
  ImageContentSchema,
]);
export type ToolContent = z.infer<typeof ToolContentSchema>;

export interface ToolExecutionResult<TDetails = any> {
  content: ToolContent[];
  details?: TDetails;
}

// 含函数签名，保留 TS interface
export interface ToolDefinition<T extends ZodType = ZodType, TDetails = any> {
  name: string;
  label: string;
  description: string;
  parameters: T;
  execute: (
    toolCallId: string,
    params: T["_output"],
    signal?: AbortSignal,
  ) => Promise<ToolExecutionResult<TDetails>>;
}

// 含函数签名，保留 TS interface
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

export type ToolName = "ls" | "read" | "edit" | "write" | "grep";

export function isTextContent(content: ToolContent): content is TextContent {
  return content.type === "text";
}

export function getTextContent(result: ToolExecutionResult): string {
  const textContent = result.content.find(isTextContent);
  return textContent?.text ?? "";
}

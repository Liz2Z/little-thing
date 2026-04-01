import { z } from "zod";

export const ToolParamValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.undefined(),
]);

export type ToolParamValue = z.infer<typeof ToolParamValueSchema>;

export const ToolParamsSchema = z.record(z.string(), ToolParamValueSchema);

export type ToolParams = z.infer<typeof ToolParamsSchema>;

export const ToolUseContentSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: ToolParamsSchema,
});

export type ToolUseContent = z.infer<typeof ToolUseContentSchema>;

export const ToolResultContentSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  tool_name: z.string(),
  content: z.string(),
  is_error: z.boolean().optional(),
});

export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;

export const TextContentSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export type TextContent = z.infer<typeof TextContentSchema>;

export const MessageContentSchema = z.union([
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
]);

export type MessageContent = z.infer<typeof MessageContentSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: MessageContentSchema,
  timestamp: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

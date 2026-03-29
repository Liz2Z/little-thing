import { z } from 'zod';

export const EventStatusSchema = z.enum(['start', 'pending', 'completed', 'failed']);

export type EventStatus = z.infer<typeof EventStatusSchema>;

export const AgentStopReasonSchema = z.enum([
  'end_turn',
  'tool_use',
  'max_tokens',
  'stop_sequence',
  'user_abort',
  'error',
  'timeout',
]);

export type AgentStopReason = z.infer<typeof AgentStopReasonSchema>;

export const AgentErrorTypeSchema = z.enum([
  'llm_error',
  'tool_error',
  'timeout',
  'user_abort',
  'unknown',
]);

export type AgentErrorType = z.infer<typeof AgentErrorTypeSchema>;

export const AgentEventTypeSchema = z.enum([
  'agent_start',
  'agent_thinking',
  'agent_content',
  'tool_use',
  'agent_complete',
  'agent_error',
  'agent_abort',
]);

export type AgentEventType = z.infer<typeof AgentEventTypeSchema>;

export const AgentEventBaseSchema = z.object({
  type: AgentEventTypeSchema,
  run_id: z.string(),
  seq: z.number(),
  span_id: z.string(),
  parent_span_id: z.string().nullable(),
  timestamp: z.string(),
  status: EventStatusSchema,
});

export type AgentEventBase = z.infer<typeof AgentEventBaseSchema>;

export const AgentStartEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_start'),
  status: z.literal('start'),
  message: z.string(),
  enabled_tools: z.array(z.string()),
});

export type AgentStartEvent = z.infer<typeof AgentStartEventSchema>;

export const AgentThinkingEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_thinking'),
  status: z.union([z.literal('start'), z.literal('completed')]),
  content: z.string(),
  iteration: z.number(),
});

export type AgentThinkingEvent = z.infer<typeof AgentThinkingEventSchema>;

export const AgentContentEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_content'),
  status: z.union([z.literal('start'), z.literal('pending'), z.literal('completed')]),
  content: z.string(),
  iteration: z.number(),
});

export type AgentContentEvent = z.infer<typeof AgentContentEventSchema>;

export const ToolUseEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('tool_use'),
  status: z.union([
    z.literal('start'),
    z.literal('pending'),
    z.literal('completed'),
    z.literal('failed'),
  ]),
  tool_use_id: z.string(),
  tool_name: z.string(),
  input: z.unknown(),
  iteration: z.number(),
  result: z.string().optional(),
  error: z.string().optional(),
  duration_ms: z.number().optional(),
});

export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

export const AgentCompleteEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_complete'),
  status: z.literal('completed'),
  final_content: z.string(),
  total_iterations: z.number(),
  stop_reason: AgentStopReasonSchema,
  usage: z
    .object({
      input_tokens: z.number(),
      output_tokens: z.number(),
    })
    .optional(),
});

export type AgentCompleteEvent = z.infer<typeof AgentCompleteEventSchema>;

export const AgentErrorEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_error'),
  status: z.literal('failed'),
  error: z.string(),
  error_type: AgentErrorTypeSchema,
  iteration: z.number().optional(),
});

export type AgentErrorEvent = z.infer<typeof AgentErrorEventSchema>;

export const AgentAbortEventSchema = AgentEventBaseSchema.extend({
  type: z.literal('agent_abort'),
  status: z.literal('completed'),
  reason: z.string(),
  iteration: z.number(),
});

export type AgentAbortEvent = z.infer<typeof AgentAbortEventSchema>;

export const AgentEventSchema = z.discriminatedUnion('type', [
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentContentEventSchema,
  ToolUseEventSchema,
  AgentCompleteEventSchema,
  AgentErrorEventSchema,
  AgentAbortEventSchema,
]);

export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const AgentRunContextDataBaseSchema = z.object({
  run_id: z.string(),
  parent_span_id: z.string().nullable(),
  span_id: z.string(),
  seq: z.number(),
  iteration: z.number(),
  enabled_tools: z.array(z.string()),
  aborted: z.boolean(),
});

export type AgentRunContextData = z.infer<typeof AgentRunContextDataBaseSchema>;

export interface AgentRunContext extends AgentRunContextData {
  nextSeq(): number;
  createChildSpan(): AgentRunContext;
  abort(): void;
  isAborted(): boolean;
}

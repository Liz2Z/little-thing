import { z } from 'zod';
import { MessageSchema } from './message.js';

export const SessionMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
  systemPrompt: z.string().optional(),
  parentSessionId: z.string().optional(),
  forkedFromMessageId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  agentId: z.string().optional(),
});

export type SessionMeta = z.infer<typeof SessionMetaSchema>;

export const SessionIndexSchema = z.object({
  sessions: z.record(z.string(), SessionMetaSchema),
});

export type SessionIndex = z.infer<typeof SessionIndexSchema>;

export const SessionSchema = z.object({
  meta: SessionMetaSchema,
  messages: z.array(MessageSchema),
});

export type Session = z.infer<typeof SessionSchema>;

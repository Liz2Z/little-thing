import { describe, it, expect } from 'bun:test';
import {
  EventStatusSchema,
  AgentStopReasonSchema,
  AgentErrorTypeSchema,
  AgentEventTypeSchema,
  AgentStartEventSchema,
  AgentThinkingEventSchema,
  AgentContentEventSchema,
  ToolUseEventSchema,
  AgentCompleteEventSchema,
  AgentErrorEventSchema,
  AgentAbortEventSchema,
  AgentEventSchema,
} from '../../src/agent/agent-events.schema.js';

describe('EventStatusSchema', () => {
  it('should accept valid statuses', () => {
    expect(EventStatusSchema.parse('start')).toBe('start');
    expect(EventStatusSchema.parse('pending')).toBe('pending');
    expect(EventStatusSchema.parse('completed')).toBe('completed');
    expect(EventStatusSchema.parse('failed')).toBe('failed');
  });

  it('should reject invalid status', () => {
    expect(() => EventStatusSchema.parse('invalid')).toThrow();
  });
});

describe('AgentStopReasonSchema', () => {
  it('should accept valid stop reasons', () => {
    const validReasons = ['end_turn', 'tool_use', 'max_tokens', 'stop_sequence', 'user_abort', 'error', 'timeout'];
    for (const reason of validReasons) {
      expect(AgentStopReasonSchema.parse(reason)).toBe(reason);
    }
  });

  it('should reject invalid stop reason', () => {
    expect(() => AgentStopReasonSchema.parse('invalid')).toThrow();
  });
});

describe('AgentErrorTypeSchema', () => {
  it('should accept valid error types', () => {
    const validTypes = ['llm_error', 'tool_error', 'timeout', 'user_abort', 'unknown'];
    for (const type of validTypes) {
      expect(AgentErrorTypeSchema.parse(type)).toBe(type);
    }
  });

  it('should reject invalid error type', () => {
    expect(() => AgentErrorTypeSchema.parse('invalid')).toThrow();
  });
});

describe('AgentEventTypeSchema', () => {
  it('should accept valid event types', () => {
    const validTypes = ['agent_start', 'agent_thinking', 'agent_content', 'tool_use', 'agent_complete', 'agent_error', 'agent_abort'];
    for (const type of validTypes) {
      expect(AgentEventTypeSchema.parse(type)).toBe(type);
    }
  });

  it('should reject invalid event type', () => {
    expect(() => AgentEventTypeSchema.parse('invalid')).toThrow();
  });
});

const createBaseEvent = () => ({
  run_id: 'run_123',
  seq: 1,
  span_id: 'span_123',
  parent_span_id: null,
  timestamp: new Date().toISOString(),
});

describe('AgentStartEventSchema', () => {
  it('should parse valid agent_start event', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_start' as const,
      status: 'start' as const,
      message: 'Hello',
      enabled_tools: ['tool1', 'tool2'],
    };

    const result = AgentStartEventSchema.parse(event);
    expect(result.type).toBe('agent_start');
    expect(result.status).toBe('start');
    expect(result.message).toBe('Hello');
    expect(result.enabled_tools).toEqual(['tool1', 'tool2']);
  });

  it('should reject agent_start with invalid status', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_start',
      status: 'completed',
      message: 'Hello',
      enabled_tools: [],
    };

    expect(() => AgentStartEventSchema.parse(event)).toThrow();
  });
});

describe('AgentThinkingEventSchema', () => {
  it('should parse valid agent_thinking event with start status', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_thinking' as const,
      status: 'start' as const,
      content: 'Thinking...',
      iteration: 1,
    };

    const result = AgentThinkingEventSchema.parse(event);
    expect(result.type).toBe('agent_thinking');
    expect(result.content).toBe('Thinking...');
    expect(result.iteration).toBe(1);
  });

  it('should parse valid agent_thinking event with completed status', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_thinking' as const,
      status: 'completed' as const,
      content: 'Done thinking',
      iteration: 2,
    };

    const result = AgentThinkingEventSchema.parse(event);
    expect(result.status).toBe('completed');
  });
});

describe('AgentContentEventSchema', () => {
  it('should parse valid agent_content event', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_content' as const,
      status: 'pending' as const,
      content: 'Hello world',
      iteration: 1,
    };

    const result = AgentContentEventSchema.parse(event);
    expect(result.type).toBe('agent_content');
    expect(result.content).toBe('Hello world');
  });
});

describe('ToolUseEventSchema', () => {
  it('should parse valid tool_use event with result', () => {
    const event = {
      ...createBaseEvent(),
      type: 'tool_use' as const,
      status: 'completed' as const,
      tool_use_id: 'tool_123',
      tool_name: 'read_file',
      input: { path: '/test.txt' },
      iteration: 1,
      result: 'file content',
      duration_ms: 100,
    };

    const result = ToolUseEventSchema.parse(event);
    expect(result.type).toBe('tool_use');
    expect(result.tool_name).toBe('read_file');
    expect(result.result).toBe('file content');
    expect(result.duration_ms).toBe(100);
  });

  it('should parse valid tool_use event with error', () => {
    const event = {
      ...createBaseEvent(),
      type: 'tool_use' as const,
      status: 'failed' as const,
      tool_use_id: 'tool_123',
      tool_name: 'read_file',
      input: { path: '/test.txt' },
      iteration: 1,
      error: 'File not found',
    };

    const result = ToolUseEventSchema.parse(event);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('File not found');
    expect(result.result).toBeUndefined();
  });
});

describe('AgentCompleteEventSchema', () => {
  it('should parse valid agent_complete event', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_complete' as const,
      status: 'completed' as const,
      final_content: 'Final response',
      total_iterations: 3,
      stop_reason: 'end_turn' as const,
      usage: {
        input_tokens: 100,
        output_tokens: 50,
      },
    };

    const result = AgentCompleteEventSchema.parse(event);
    expect(result.type).toBe('agent_complete');
    expect(result.final_content).toBe('Final response');
    expect(result.total_iterations).toBe(3);
    expect(result.stop_reason).toBe('end_turn');
    expect(result.usage?.input_tokens).toBe(100);
  });

  it('should parse agent_complete without usage', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_complete' as const,
      status: 'completed' as const,
      final_content: 'Response',
      total_iterations: 1,
      stop_reason: 'end_turn' as const,
    };

    const result = AgentCompleteEventSchema.parse(event);
    expect(result.usage).toBeUndefined();
  });
});

describe('AgentErrorEventSchema', () => {
  it('should parse valid agent_error event', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_error' as const,
      status: 'failed' as const,
      error: 'Something went wrong',
      error_type: 'llm_error' as const,
      iteration: 2,
    };

    const result = AgentErrorEventSchema.parse(event);
    expect(result.type).toBe('agent_error');
    expect(result.error).toBe('Something went wrong');
    expect(result.error_type).toBe('llm_error');
  });
});

describe('AgentAbortEventSchema', () => {
  it('should parse valid agent_abort event', () => {
    const event = {
      ...createBaseEvent(),
      type: 'agent_abort' as const,
      status: 'completed' as const,
      reason: 'User requested abort',
      iteration: 3,
    };

    const result = AgentAbortEventSchema.parse(event);
    expect(result.type).toBe('agent_abort');
    expect(result.reason).toBe('User requested abort');
    expect(result.iteration).toBe(3);
  });
});

describe('AgentEventSchema (discriminated union)', () => {
  it('should parse all event types', () => {
    const events = [
      {
        ...createBaseEvent(),
        type: 'agent_start' as const,
        status: 'start' as const,
        message: 'Hello',
        enabled_tools: [],
      },
      {
        ...createBaseEvent(),
        type: 'agent_thinking' as const,
        status: 'start' as const,
        content: 'Thinking',
        iteration: 1,
      },
      {
        ...createBaseEvent(),
        type: 'agent_content' as const,
        status: 'pending' as const,
        content: 'Content',
        iteration: 1,
      },
      {
        ...createBaseEvent(),
        type: 'tool_use' as const,
        status: 'completed' as const,
        tool_use_id: 'tool_1',
        tool_name: 'test',
        input: {},
        iteration: 1,
      },
      {
        ...createBaseEvent(),
        type: 'agent_complete' as const,
        status: 'completed' as const,
        final_content: 'Done',
        total_iterations: 1,
        stop_reason: 'end_turn' as const,
      },
      {
        ...createBaseEvent(),
        type: 'agent_error' as const,
        status: 'failed' as const,
        error: 'Error',
        error_type: 'unknown' as const,
      },
      {
        ...createBaseEvent(),
        type: 'agent_abort' as const,
        status: 'completed' as const,
        reason: 'Aborted',
        iteration: 1,
      },
    ];

    for (const event of events) {
      const result = AgentEventSchema.parse(event);
      expect(result.run_id).toBe('run_123');
    }
  });

  it('should reject event with unknown type', () => {
    const event = {
      ...createBaseEvent(),
      type: 'unknown',
      status: 'start',
    };

    expect(() => AgentEventSchema.parse(event)).toThrow();
  });
});

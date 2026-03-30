import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { ToolExecutor } from '../../src/tools/registry.js';
import type { AgentEvent, AgentStartEvent, AgentCompleteEvent, AgentErrorEvent, AgentAbortEvent, ToolUseEvent } from '../../src/agent/agent-events.schema.js';

type StreamTextMock = (...args: any[]) => Promise<{ fullStream: AsyncGenerator<any> }>;

let currentStreamTextMock: StreamTextMock | null = null;

mock.module('ai', () => ({
  streamText: async (...args: any[]) => {
    if (currentStreamTextMock) {
      return await currentStreamTextMock(...args);
    }
    return {
      fullStream: (async function* () {
        yield { type: 'finish', totalUsage: { promptTokens: 0, completionTokens: 0 }, finishReason: 'stop' };
      })(),
    };
  },
}));

const { Agent } = await import('../../src/agent/agent.js');

const createMockToolExecutor = (
  tools: Array<{ name: string; description: string; parameters: any }> = [],
  executeResult?: { success: boolean; output?: string; error?: string },
): ToolExecutor => ({
  execute: mock(async () => executeResult || { success: true, output: 'ok' }),
  getDefinition: mock((name: string) => tools.find(t => t.name === name)),
  getAllDefinitions: mock(() => tools.map(t => ({
    ...t,
    label: t.name,
    parameters: {},
    execute: mock(async () => ({ content: [{ type: 'text' as const, text: 'result' }] })),
  }))),
});

const createStreamTextResponse = (parts: any[]): StreamTextMock => {
  return async () => ({
    fullStream: (async function* () {
      for (const part of parts) {
        yield part;
      }
    })(),
  });
};

describe('Agent', () => {
  let mockToolExecutor: ToolExecutor;
  let mockModel: any;

  beforeEach(() => {
    currentStreamTextMock = null;
    mockModel = {};
    mockToolExecutor = createMockToolExecutor([
      { name: 'test_tool', description: 'A test tool', parameters: {} },
    ]);
  });

  describe('abort', () => {
    it('should return false when run does not exist', async () => {
      const agent = new Agent(mockModel, mockToolExecutor);
      const result = agent.abort('non-existent-run');
      expect(result).toBe(false);
    });

    it('should return true and abort existing run', async () => {
      let resolveStream: () => void;
      const streamReady = new Promise<void>(resolve => { resolveStream = resolve; });

      currentStreamTextMock = async () => ({
        fullStream: (async function* () {
          await streamReady;
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' };
        })(),
      });

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      let runStarted = false;

      const runPromise = (async () => {
        for await (const event of agent.run('test message', [], { runId: 'test-run' })) {
          events.push(event);
          if (!runStarted && event.type === 'agent_start') {
            runStarted = true;
            const abortResult = agent.abort('test-run');
            expect(abortResult).toBe(true);
            resolveStream!();
          }
        }
      })();

      await runPromise;

      const abortEvent = events.find(e => e.type === 'agent_abort') as AgentAbortEvent;
      expect(abortEvent).toBeDefined();
    });
  });

  describe('run', () => {
    it('should yield agent_start event first', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
        break;
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('agent_start');
      const startEvent = events[0] as AgentStartEvent;
      expect(startEvent.message).toBe('Hello');
      expect(startEvent.status).toBe('start');
    });

    it('should use enabledTools from options', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [], { enabledTools: ['custom_tool'] })) {
        events.push(event);
        break;
      }

      const startEvent = events[0] as AgentStartEvent;
      expect(startEvent.enabled_tools).toEqual(['custom_tool']);
    });

    it('should use all tools from executor when enabledTools not specified', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
        break;
      }

      const startEvent = events[0] as AgentStartEvent;
      expect(startEvent.enabled_tools).toContain('test_tool');
    });
  });

  describe('run with abort signal', () => {
    it('should abort when external abort signal is triggered', async () => {
      let resolveStream: () => void;
      const streamReady = new Promise<void>(resolve => { resolveStream = resolve; });

      currentStreamTextMock = async () => ({
        fullStream: (async function* () {
          await streamReady;
          yield { type: 'text-delta', text: 'Response' };
          yield { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' };
        })(),
      });

      const agent = new Agent(mockModel, mockToolExecutor);
      const controller = new AbortController();
      const events: AgentEvent[] = [];
      let started = false;

      const runPromise = (async () => {
        for await (const event of agent.run('Hello', [], { abortSignal: controller.signal })) {
          events.push(event);
          if (!started) {
            started = true;
            controller.abort();
            resolveStream!();
          }
        }
      })();

      await runPromise;

      const abortEvent = events.find(e => e.type === 'agent_abort') as AgentAbortEvent;
      expect(abortEvent).toBeDefined();
    });
  });

  describe('event sequencing', () => {
    it('should have consistent run_id across all events', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
      }

      const runIds = new Set(events.map(e => e.run_id));
      expect(runIds.size).toBe(1);
    });

    it('should have consistent span_id across all events', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
      }

      const spanIds = new Set(events.map(e => e.span_id));
      expect(spanIds.size).toBe(1);
    });

    it('should have timestamp in ISO format', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
      }

      for (const event of events) {
        expect(event.timestamp).toBeDefined();
        const date = new Date(event.timestamp);
        expect(date.toISOString()).toBe(event.timestamp);
      }
    });
  });

  describe('event properties', () => {
    it('should include parent_span_id as null by default', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events.push(event);
        break;
      }

      expect(events[0].parent_span_id).toBeNull();
    });

    it('should generate unique run_id for each run', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);

      const events1: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events1.push(event);
        break;
      }

      const events2: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [])) {
        events2.push(event);
        break;
      }

      expect(events1[0].run_id).not.toBe(events2[0].run_id);
    });

    it('should use custom run_id when provided', async () => {
      currentStreamTextMock = createStreamTextResponse([
        { type: 'text-delta', text: 'Response' },
        { type: 'finish', totalUsage: { promptTokens: 10, completionTokens: 5 }, finishReason: 'stop' },
      ]);

      const agent = new Agent(mockModel, mockToolExecutor);
      const events: AgentEvent[] = [];
      for await (const event of agent.run('Hello', [], { runId: 'custom-run-id' })) {
        events.push(event);
        break;
      }

      expect(events[0].run_id).toBe('custom-run-id');
    });
  });
});

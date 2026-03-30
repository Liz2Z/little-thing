import { describe, it, expect, beforeEach } from 'bun:test';
import { createAgentRunContext } from '../../src/agent/context.js';

describe('createAgentRunContext', () => {
  describe('基本属性', () => {
    it('should create context with auto-generated run_id and span_id', () => {
      const ctx = createAgentRunContext(['tool1', 'tool2']);

      expect(ctx.run_id).toMatch(/^run_/);
      expect(ctx.span_id).toMatch(/^span_/);
      expect(ctx.parent_span_id).toBeNull();
      expect(ctx.seq).toBe(0);
      expect(ctx.iteration).toBe(0);
      expect(ctx.enabled_tools).toEqual(['tool1', 'tool2']);
      expect(ctx.aborted).toBe(false);
    });

    it('should create context with custom run_id', () => {
      const ctx = createAgentRunContext(['tool1'], null, 'custom-run-id');

      expect(ctx.run_id).toBe('custom-run-id');
    });

    it('should create context with parent_span_id', () => {
      const ctx = createAgentRunContext(['tool1'], 'parent-span-123');

      expect(ctx.parent_span_id).toBe('parent-span-123');
    });
  });

  describe('nextSeq', () => {
    it('should increment sequence number on each call', () => {
      const ctx = createAgentRunContext([]);

      expect(ctx.nextSeq()).toBe(1);
      expect(ctx.nextSeq()).toBe(2);
      expect(ctx.nextSeq()).toBe(3);
      expect(ctx.seq).toBe(3);
    });
  });

  describe('abort', () => {
    it('should set aborted to true', () => {
      const ctx = createAgentRunContext([]);

      expect(ctx.aborted).toBe(false);
      ctx.abort();
      expect(ctx.aborted).toBe(true);
    });
  });

  describe('isAborted', () => {
    it('should return false initially', () => {
      const ctx = createAgentRunContext([]);

      expect(ctx.isAborted()).toBe(false);
    });

    it('should return true after abort is called', () => {
      const ctx = createAgentRunContext([]);
      ctx.abort();

      expect(ctx.isAborted()).toBe(true);
    });
  });

  describe('createChildSpan', () => {
    it('should create child context with parent_span_id set to current span_id', () => {
      const parentCtx = createAgentRunContext(['tool1', 'tool2']);
      const childCtx = parentCtx.createChildSpan();

      expect(childCtx.parent_span_id).toBe(parentCtx.span_id);
      expect(childCtx.run_id).toBe(parentCtx.run_id);
      expect(childCtx.enabled_tools).toEqual(parentCtx.enabled_tools);
      expect(childCtx.span_id).not.toBe(parentCtx.span_id);
      expect(childCtx.span_id).toMatch(/^span_/);
    });

    it('should create independent child contexts', () => {
      const parentCtx = createAgentRunContext(['tool1']);
      const child1 = parentCtx.createChildSpan();
      const child2 = parentCtx.createChildSpan();

      expect(child1.span_id).not.toBe(child2.span_id);
      expect(child1.parent_span_id).toBe(parentCtx.span_id);
      expect(child2.parent_span_id).toBe(parentCtx.span_id);
    });

    it('child context should have independent seq and iteration', () => {
      const parentCtx = createAgentRunContext([]);
      parentCtx.nextSeq();
      parentCtx.iteration = 5;

      const childCtx = parentCtx.createChildSpan();

      expect(childCtx.seq).toBe(0);
      expect(childCtx.iteration).toBe(0);
    });
  });
});

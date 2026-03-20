import { randomUUID } from 'crypto';
import type { AgentRunContext } from './types.js';

export function createAgentRunContext(
  enabled_tools: string[],
  max_iterations: number = 10,
  parent_span_id: string | null = null,
  run_id?: string
): AgentRunContext {
  const actual_run_id = run_id || randomUUID();
  let seq = 0;
  let aborted = false;

  return {
    run_id: actual_run_id,
    parent_span_id,
    seq_counter: 0,
    iteration: 0,
    max_iterations,
    enabled_tools,
    aborted,

    nextSeq(): number {
      return ++seq;
    },

    newSpanId(): string {
      return `${actual_run_id}-${++seq}`;
    },

    createChildSpan(): AgentRunContext {
      return createAgentRunContext(
        this.enabled_tools,
        this.max_iterations,
        this.newSpanId(),
        this.run_id
      );
    },

    abort(): void {
      aborted = true;
    },

    isAborted(): boolean {
      return aborted;
    },
  };
}

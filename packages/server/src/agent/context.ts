import { randomUUID } from "crypto";
import type { AgentRunContext } from "./types.js";

export function createAgentRunContext(
  enabled_tools: string[],
  parent_span_id: string | null = null,
  run_id?: string,
): AgentRunContext {
  const actual_run_id = run_id || `run_${randomUUID()}`;

  return {
    run_id: actual_run_id,
    span_id: `span_${randomUUID()}`,
    parent_span_id,
    seq: 0,
    iteration: 0,
    enabled_tools,
    aborted: false,

    nextSeq(): number {
      return ++this.seq;
    },

    createChildSpan(): AgentRunContext {
      return createAgentRunContext(
        this.enabled_tools,
        this.span_id,
        this.run_id,
      );
    },

    abort(): void {
      this.aborted = true;
    },

    isAborted(): boolean {
      return this.aborted;
    },
  };
}

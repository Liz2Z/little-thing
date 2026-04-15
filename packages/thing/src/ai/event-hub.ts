import { randomUUID } from "node:crypto";
import type { AgentEvent } from "../agent/events.js";

export interface RunEventEnvelope {
  run_id: string;
  session_id?: string;
  event: AgentEvent;
}

export interface RunEventFilter {
  runId?: string;
  sessionId?: string;
}

interface Subscriber {
  id: string;
  filter: RunEventFilter;
  queue: RunEventEnvelope[];
  notify: (() => void) | null;
  closed: boolean;
}

function matchesFilter(
  event: RunEventEnvelope,
  filter: RunEventFilter | undefined,
): boolean {
  if (!filter) {
    return true;
  }

  if (filter.runId && event.run_id !== filter.runId) {
    return false;
  }

  if (filter.sessionId && event.session_id !== filter.sessionId) {
    return false;
  }

  return true;
}

export class RunEventHub {
  private subscribers = new Map<string, Subscriber>();

  publish(event: RunEventEnvelope): void {
    for (const subscriber of this.subscribers.values()) {
      if (subscriber.closed || !matchesFilter(event, subscriber.filter)) {
        continue;
      }

      subscriber.queue.push(event);
      subscriber.notify?.();
      subscriber.notify = null;
    }
  }

  async *subscribe(
    filter: RunEventFilter = {},
    options: { signal?: AbortSignal } = {},
  ): AsyncGenerator<RunEventEnvelope> {
    const subscriber: Subscriber = {
      id: `sub_${randomUUID()}`,
      filter,
      queue: [],
      notify: null,
      closed: false,
    };
    this.subscribers.set(subscriber.id, subscriber);

    const abortHandler = () => {
      subscriber.closed = true;
      subscriber.notify?.();
      subscriber.notify = null;
    };
    options.signal?.addEventListener("abort", abortHandler, { once: true });

    try {
      while (!subscriber.closed) {
        if (subscriber.queue.length === 0) {
          await new Promise<void>((resolve) => {
            subscriber.notify = resolve;
          });
        }

        while (subscriber.queue.length > 0) {
          const next = subscriber.queue.shift();
          if (next) {
            yield next;
          }
        }
      }
    } finally {
      options.signal?.removeEventListener("abort", abortHandler);
      this.subscribers.delete(subscriber.id);
    }
  }
}

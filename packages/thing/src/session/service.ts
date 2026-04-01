import type {
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentEvent,
} from "../agent/events.js";
import type { AIService } from "../ai/service.js";
import { ValidationError } from "../lib/error.js";
import type { Message } from "./message.js";
import type { Session, SessionMeta } from "./session.schema.js";
import type { SessionStore } from "./store.js";

class ProviderRequiredError extends ValidationError {
  constructor() {
    super([
      "SESSION-PROVIDER_REQUIRED",
      400,
      "Provider 和 model 是必需的",
    ] as const);
  }
}

export interface ChatOptions {
  enabledTools?: string[];
  provider?: string;
  model?: string;
}

export class SessionService {
  constructor(
    private sessionStore: SessionStore,
    private aiService: AIService,
  ) {}

  listSessions(): SessionMeta[] {
    return this.sessionStore.listSessions();
  }

  getSession(id: string): Session | null {
    return this.sessionStore.getSession(id);
  }

  createSession(name?: string, provider?: string, model?: string): SessionMeta {
    return this.sessionStore.createSession(name, provider, model);
  }

  deleteSession(id: string): boolean {
    return this.sessionStore.deleteSession(id);
  }

  renameSession(id: string, name: string): boolean {
    return this.sessionStore.renameSession(id, name);
  }

  addMessage(sessionId: string, message: Omit<Message, "id">): boolean {
    return this.sessionStore.addMessage(sessionId, message);
  }

  forkSession(
    sessionId: string,
    messageId: string,
    name?: string,
  ): SessionMeta | null {
    return this.sessionStore.forkSession(sessionId, messageId, name);
  }

  resumeSession(sessionId: string, messageId: string): boolean {
    return this.sessionStore.resumeSession(sessionId, messageId);
  }

  abort(runId: string): void {
    this.aiService.abort(runId);
  }

  async *chat(
    sessionId: string,
    message: string,
    options?: ChatOptions,
  ): AsyncGenerator<AgentEvent> {
    const session = this.sessionStore.getSession(sessionId);
    if (!session) {
      const errorEvent: AgentErrorEvent = {
        type: "agent_error",
        error: "Session not found",
        error_type: "unknown",
        run_id: "",
        seq: 0,
        span_id: "",
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      };
      yield errorEvent;
      return;
    }

    const provider = options?.provider || session.meta.provider;
    const model = options?.model || session.meta.model;

    if (!provider || !model) {
      throw new ProviderRequiredError();
    }

    try {
      for await (const event of this.aiService.chat(message, session.messages, {
        provider,
        model,
        enabledTools: options?.enabledTools,
      })) {
        yield event;

        if (event.type === "agent_complete" || event.type === "agent_error") {
          this.sessionStore.addMessage(sessionId, {
            role: "user",
            content: { type: "text", text: message },
            timestamp: new Date().toISOString(),
          });
          if (event.type === "agent_complete") {
            this.sessionStore.addMessage(sessionId, {
              role: "assistant",
              content: {
                type: "text",
                text: (event as AgentCompleteEvent).final_content,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error) {
      const errorEvent: AgentErrorEvent = {
        type: "agent_error",
        error: error instanceof Error ? error.message : "Unknown error",
        error_type: "unknown",
        run_id: "",
        seq: 0,
        span_id: "",
        parent_span_id: null,
        timestamp: new Date().toISOString(),
      };
      yield errorEvent;
    }
  }
}

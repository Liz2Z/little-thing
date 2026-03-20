import {
  client,
  healthCheck,
  sessionsList,
  sessionsCreate,
  sessionsGet,
  sessionsDelete,
  sessionsRename,
  sessionsMessagesAdd,
  type SessionsGetResponse,
  type SessionsListResponse,
} from '@littlething/sdk';

export type Message = SessionsGetResponse['session']['messages'][number];
export type SessionMeta = SessionsListResponse['sessions'][number];
export type Session = SessionsGetResponse['session'];

export interface CliConfig {
  serverUrl: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(config: CliConfig) {
    this.baseUrl = config.serverUrl;
    client.getConfig().baseUrl = config.serverUrl;
  }

  async listSessions(): Promise<SessionMeta[]> {
    const result = await sessionsList();
    return result.data?.sessions ?? [];
  }

  async createSession(name?: string): Promise<SessionMeta> {
    const result = await sessionsCreate({ body: { name } });
    if (!result.data) throw new Error('Failed to create session');
    return result.data.session;
  }

  async getSession(sessionId: string): Promise<Session> {
    const result = await sessionsGet({ path: { id: sessionId } });
    if (!result.data) throw new Error('Session not found');
    return result.data.session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await sessionsDelete({ path: { id: sessionId } });
  }

  async renameSession(sessionId: string, name: string): Promise<void> {
    await sessionsRename({ path: { id: sessionId }, body: { name } });
  }

  async addMessage(sessionId: string, message: Omit<Message, 'timestamp'>): Promise<void> {
    await sessionsMessagesAdd({
      path: { id: sessionId },
      body: {
        role: message.role,
        content: message.content,
      },
    });
  }

  async *agentChat(
    sessionId: string,
    message: string,
    options?: { enabledTools?: string[]; maxIterations?: number }
  ): AsyncGenerator<AgentEvent> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        enabledTools: options?.enabledTools,
        maxIterations: options?.maxIterations,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent chat failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const event = JSON.parse(data) as AgentEvent;
              yield event;
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async abortAgent(sessionId: string, runId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/agent/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.success;
  }

  async health(): Promise<{ status: string; model: string }> {
    const result = await healthCheck();
    if (!result.data) throw new Error('Health check failed');
    return result.data;
  }
}

export type AgentEventType =
  | 'agent_start'
  | 'agent_thinking'
  | 'agent_content'
  | 'tool_use'
  | 'agent_complete'
  | 'agent_error'
  | 'agent_abort';

export type EventStatus = 'start' | 'pending' | 'completed' | 'failed';

export interface AgentEventBase {
  type: AgentEventType;
  run_id: string;
  seq: number;
  span_id: string;
  parent_span_id: string | null;
  timestamp: string;
  status: EventStatus;
}

export interface AgentStartEvent extends AgentEventBase {
  type: 'agent_start';
  message: string;
  enabled_tools: string[];
  max_iterations: number;
}

export interface AgentThinkingEvent extends AgentEventBase {
  type: 'agent_thinking';
  content: string;
  iteration: number;
}

export interface AgentContentEvent extends AgentEventBase {
  type: 'agent_content';
  content: string;
  iteration: number;
}

export interface ToolUseEvent extends AgentEventBase {
  type: 'tool_use';
  tool_use_id: string;
  tool_name: string;
  input: unknown;
  iteration: number;
  result?: string;
  error?: string;
  duration_ms?: number;
}

export interface AgentCompleteEvent extends AgentEventBase {
  type: 'agent_complete';
  final_content: string;
  total_iterations: number;
  stop_reason: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface AgentErrorEvent extends AgentEventBase {
  type: 'agent_error';
  error: string;
  error_type: string;
  iteration?: number;
}

export interface AgentAbortEvent extends AgentEventBase {
  type: 'agent_abort';
  reason: string;
  iteration: number;
}

export type AgentEvent =
  | AgentStartEvent
  | AgentThinkingEvent
  | AgentContentEvent
  | ToolUseEvent
  | AgentCompleteEvent
  | AgentErrorEvent
  | AgentAbortEvent;

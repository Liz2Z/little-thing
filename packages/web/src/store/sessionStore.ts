import { create } from 'zustand';
import {
  sessionsList,
  sessionsCreate,
  sessionsDelete,
  sessionsGet,
  sessionsFork,
  sessionsResume,
  type SessionsListResponse,
  type SessionsGetResponse,
} from '@littlething/sdk';
import { useConfigStore } from './configStore';
import {
  AgentEventType,
  type AgentEvent,
  type AgentRunState,
  type ToolUseEvent,
} from '@/lib/agent-types';

type Session = SessionsListResponse['sessions'][number];
type Message = SessionsGetResponse['session']['messages'][number];

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseSSEEvent(line: string): { event: string; data: string } | null {
  if (line.startsWith('event:')) {
    return { event: line.slice(6).trim(), data: '' };
  }
  if (line.startsWith('data:')) {
    return { event: '', data: line.slice(5).trim() };
  }
  return null;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionMessages: Message[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  inputText: string;
  agentRunState: AgentRunState | null;
  isAgentRunning: boolean;

  initialize: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  fetchSessionMessages: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortAgent: () => Promise<void>;
  clearError: () => void;
  addSession: (session: Session) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<Session>) => void;
  setInputText: (text: string) => void;
  forkSession: (sessionId: string, messageId: string, name?: string) => Promise<Session>;
  resumeSession: (sessionId: string, messageId: string, messageContent: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSessionMessages: [],
  isLoading: false,
  error: null,
  initialized: false,
  inputText: '',
  agentRunState: null,
  isAgentRunning: false,

  initialize: async () => {
    if (get().initialized) return;

    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      const response = await sessionsList({ baseUrl });
      const sessions = response.data?.sessions ?? [];

      if (sessions.length === 0) {
        const createResponse = await sessionsCreate({
          baseUrl,
          body: {
            name: `会话 ${new Date().toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`
          }
        });
        const newSession = createResponse.data?.session;
        if (newSession) {
          set({
            sessions: [newSession],
            activeSessionId: newSession.id,
            activeSessionMessages: [],
            isLoading: false,
            initialized: true,
          });
        }
      } else {
        set({
          sessions,
          isLoading: false,
          initialized: true,
        });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
      });
    }
  },

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      const response = await sessionsList({ baseUrl });
      const sessions = response.data?.sessions ?? [];
      set({ sessions, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
        isLoading: false,
      });
    }
  },

  createSession: async (name) => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      const response = await sessionsCreate({
        baseUrl,
        body: { name }
      });
      const session = response.data?.session;
      if (!session) {
        throw new Error('Failed to create session: no session returned');
      }
      set((state) => ({
        sessions: [...state.sessions, session],
        isLoading: false,
      }));
      return session;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create session',
        isLoading: false,
      });
      throw error;
    }
  },

  deleteSession: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      await sessionsDelete({
        baseUrl,
        path: { id }
      });
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== id),
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        isLoading: false,
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete session',
        isLoading: false,
      });
    }
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
    if (id) {
      get().fetchSessionMessages(id);
    } else {
      set({ activeSessionMessages: [] });
    }
  },

  fetchSessionMessages: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      const response = await sessionsGet({
        baseUrl,
        path: { id }
      });
      const session = response.data?.session;
      set({
        activeSessionMessages: session?.messages ?? [],
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
        isLoading: false,
      });
    }
  },

  sendMessage: async (content: string) => {
    const { activeSessionId } = get();
    if (!activeSessionId) {
      throw new Error('No active session');
    }

    const userMessage: Message = {
      id: generateTempId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      activeSessionMessages: [...state.activeSessionMessages, userMessage],
      isAgentRunning: true,
      agentRunState: null,
    }));

    try {
      const apiUrl = useConfigStore.getState().apiUrl;

      const response = await fetch(`${apiUrl}/sessions/${activeSessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentRunState: AgentRunState | null = null;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const parsed = parseSSEEvent(trimmed);
            if (parsed) {
              if (parsed.event) {
                currentEvent = parsed.event;
              } else if (parsed.data && currentEvent) {
                try {
                  const event = JSON.parse(parsed.data) as AgentEvent;
                  currentRunState = handleAgentEvent(event, currentRunState, set, get);
                } catch (e) {
                  console.error('Failed to parse event:', e);
                }
                currentEvent = '';
              }
            }
          }
        }

        if (currentRunState) {
          set((state) => {
            const messages = [...state.activeSessionMessages];
            if (currentRunState!.content) {
              const assistantMessage: Message = {
                id: generateTempId(),
                role: 'assistant',
                content: currentRunState!.content,
                timestamp: new Date().toISOString(),
              };
              messages.push(assistantMessage);
            }
            return {
              activeSessionMessages: messages,
              isAgentRunning: false,
              agentRunState: currentRunState,
            };
          });
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
        isAgentRunning: false,
      });
      throw error;
    }
  },

  abortAgent: async () => {
    const { activeSessionId, agentRunState } = get();
    if (!activeSessionId || !agentRunState) return;

    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      await fetch(`${apiUrl}/sessions/${activeSessionId}/agent/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: agentRunState.run_id }),
      });
      set({ isAgentRunning: false });
    } catch (error) {
      console.error('Failed to abort agent:', error);
    }
  },

  clearError: () => set({ error: null }),

  addSession: (session: Session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
    }));
  },

  removeSession: (id: string) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    }));
  },

  updateSession: (id: string, updates: Partial<Session>) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
  },

  setInputText: (text: string) => {
    set({ inputText: text });
  },

  forkSession: async (sessionId: string, messageId: string, name?: string) => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      const response = await sessionsFork({
        baseUrl,
        path: { id: sessionId },
        body: { messageId, name }
      });
      const session = response.data?.session;
      if (!session) {
        throw new Error('Failed to fork session: no session returned');
      }
      set((state) => ({
        sessions: [...state.sessions, session],
        activeSessionId: session.id,
        isLoading: false,
      }));
      await get().fetchSessionMessages(session.id);
      return session;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fork session',
        isLoading: false,
      });
      throw error;
    }
  },

  resumeSession: async (sessionId: string, messageId: string, messageContent: string) => {
    set({ isLoading: true, error: null });
    try {
      const baseUrl = useConfigStore.getState().apiUrl;
      await sessionsResume({
        baseUrl,
        path: { id: sessionId },
        body: { messageId }
      });
      set((state) => {
        const filteredMessages: Message[] = [];
        for (const m of state.activeSessionMessages) {
          if (m.id === messageId) {
            break;
          }
          filteredMessages.push(m);
        }
        return {
          activeSessionMessages: filteredMessages,
          inputText: messageContent,
          isLoading: false,
        };
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to resume session',
        isLoading: false,
      });
      throw error;
    }
  },
}));

function handleAgentEvent(
  event: AgentEvent,
  currentRunState: AgentRunState | null,
  set: (partial: Partial<SessionState>) => void,
  _get: () => SessionState
): AgentRunState {
  switch (event.type) {
    case AgentEventType.Start: {
      const newState: AgentRunState = {
        run_id: event.run_id,
        status: 'running',
        content: '',
        toolCalls: new Map(),
        startTime: Date.now(),
      };
      set({ agentRunState: newState });
      return newState;
    }

    case AgentEventType.Thinking: {
      if (!currentRunState) return currentRunState!;
      const updated = { ...currentRunState, thinking: event.content };
      set({ agentRunState: updated });
      return updated;
    }

    case AgentEventType.Content: {
      if (!currentRunState) return currentRunState!;
      const updated = {
        ...currentRunState,
        content: currentRunState.content + event.content,
      };
      set({ agentRunState: updated });
      return updated;
    }

    case AgentEventType.ToolUse: {
      if (!currentRunState) return currentRunState!;
      const toolCalls = new Map(currentRunState.toolCalls);
      const existing = toolCalls.get(event.tool_use_id);
      if (existing) {
        toolCalls.set(event.tool_use_id, {
          ...existing,
          ...event,
        } as ToolUseEvent);
      } else {
        toolCalls.set(event.tool_use_id, event);
      }
      const updated = { ...currentRunState, toolCalls };
      set({ agentRunState: updated });
      return updated;
    }

    case AgentEventType.Complete: {
      if (!currentRunState) return currentRunState!;
      const updated: AgentRunState = {
        ...currentRunState,
        status: 'completed',
        content: event.final_content,
        endTime: Date.now(),
        stop_reason: event.stop_reason,
        usage: event.usage,
      };
      set({ agentRunState: updated, isAgentRunning: false });
      return updated;
    }

    case AgentEventType.Error: {
      if (!currentRunState) return currentRunState!;
      const updated: AgentRunState = {
        ...currentRunState,
        status: 'error',
        endTime: Date.now(),
        error: event.error,
      };
      set({ agentRunState: updated, isAgentRunning: false });
      return updated;
    }

    case AgentEventType.Abort: {
      if (!currentRunState) return currentRunState!;
      const updated: AgentRunState = {
        ...currentRunState,
        status: 'aborted',
        endTime: Date.now(),
      };
      set({ agentRunState: updated, isAgentRunning: false });
      return updated;
    }

    default:
      return currentRunState!;
  }
}

export type { Session, Message };

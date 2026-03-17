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

type Session = SessionsListResponse['sessions'][number];
type Message = SessionsGetResponse['session']['messages'][number];

function generateTempId(): string {
  return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionMessages: Message[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
  inputText: string;

  initialize: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  fetchSessionMessages: (id: string) => Promise<void>;
  sendMessage: (content: string) => AsyncGenerator<string>;
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

  sendMessage: async function* (content: string) {
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
    }));

    try {
      const apiUrl = useConfigStore.getState().apiUrl;

      let fullResponse = '';
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100;

      const response = await fetch(`${apiUrl}/sessions/${activeSessionId}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      });

      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          const now = Date.now();
          if (now - lastUpdateTime >= UPDATE_INTERVAL) {
            set((state) => {
              const messages = [...state.activeSessionMessages];
              if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
                messages[messages.length - 1] = {
                  ...messages[messages.length - 1],
                  content: fullResponse,
                  timestamp: new Date().toISOString(),
                };
              } else {
                messages.push({
                  id: generateTempId(),
                  role: 'assistant',
                  content: fullResponse,
                  timestamp: new Date().toISOString(),
                });
              }
              return { activeSessionMessages: messages };
            });
            lastUpdateTime = now;
          }
          yield chunk;
        }
      } finally {
        reader.releaseLock();
      }

      set((state) => {
        const messages = [...state.activeSessionMessages];
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content: fullResponse,
            timestamp: new Date().toISOString(),
          };
        } else {
          messages.push({
            id: generateTempId(),
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });
        }
        return { activeSessionMessages: messages };
      });

      yield fullResponse;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
      throw error;
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

export type { Session, Message };

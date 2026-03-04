import { create } from 'zustand';
import type { Session, Message } from '@/api/types';
import { ApiClient } from '@/api/client';
import { useConfigStore } from './configStore';

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  activeSessionMessages: Message[];
  isLoading: boolean;
  error: string | null;

  fetchSessions: () => Promise<void>;
  createSession: (name?: string) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;
  setActiveSession: (id: string | null) => void;
  fetchSessionMessages: (id: string) => Promise<void>;
  sendMessage: (content: string) => AsyncGenerator<string>;
  clearError: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSessionMessages: [],
  isLoading: false,
  error: null,

  fetchSessions: async () => {
    set({ isLoading: true, error: null });
    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const sessions = await client.getSessions();
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
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const session = await client.createSession(name);
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
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      await client.deleteSession(id);
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
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);
      const session = await client.getSession(id);
      set({
        activeSessionMessages: session.messages,
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
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      activeSessionMessages: [...state.activeSessionMessages, userMessage],
    }));

    try {
      const apiUrl = useConfigStore.getState().apiUrl;
      const client = new ApiClient(apiUrl);

      let fullResponse = '';
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 100;

      for await (const chunk of client.streamChat(activeSessionId, content)) {
        fullResponse += chunk;
        
        const now = Date.now();
        if (now - lastUpdateTime >= UPDATE_INTERVAL) {
          set((state) => {
            const messages = [...state.activeSessionMessages];
            if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
              messages[messages.length - 1] = {
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
              };
            } else {
              messages.push({
                role: 'assistant',
                content: fullResponse,
                timestamp: new Date().toISOString(),
              });
            }
            return { activeSessionMessages: messages };
          });
          lastUpdateTime = now;
        }
      }

      set((state) => {
        const messages = [...state.activeSessionMessages];
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          messages[messages.length - 1] = {
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          };
        } else {
          messages.push({
            role: 'assistant',
            content: fullResponse,
            timestamp: new Date().toISOString(),
          });
        }
        return { activeSessionMessages: messages };
      });

      get().fetchSessions();
      yield fullResponse;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));

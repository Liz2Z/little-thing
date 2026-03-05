/**
 * 事件状态管理
 * 使用 Zustand 管理事件相关的全局状态
 */

import { create } from 'zustand';
import { EventType, type TypedEvent } from '@littlething/sdk';

interface EventState {
  lastEvent: TypedEvent | null;
  sessionEvents: {
    created: TypedEvent<'session:created'>[];
    deleted: TypedEvent<'session:deleted'>[];
    updated: TypedEvent<'session:updated'>[];
  };
  messages: TypedEvent<'message:received'>[];
  
  handleEvent: (event: TypedEvent) => void;
  clearEvents: () => void;
}

export const useEventStore = create<EventState>((set) => ({
  lastEvent: null,
  sessionEvents: {
    created: [],
    deleted: [],
    updated: [],
  },
  messages: [],

  handleEvent: (event) => {
    set((state) => {
      const newState: Partial<EventState> = {
        lastEvent: event,
      };

      switch (event.type) {
        case EventType.SESSION_CREATED:
          newState.sessionEvents = {
            ...state.sessionEvents,
            created: [...state.sessionEvents.created, event as TypedEvent<'session:created'>],
          };
          break;
        case EventType.SESSION_DELETED:
          newState.sessionEvents = {
            ...state.sessionEvents,
            deleted: [...state.sessionEvents.deleted, event as TypedEvent<'session:deleted'>],
          };
          break;
        case EventType.SESSION_UPDATED:
          newState.sessionEvents = {
            ...state.sessionEvents,
            updated: [...state.sessionEvents.updated, event as TypedEvent<'session:updated'>],
          };
          break;
        case EventType.MESSAGE_RECEIVED:
          newState.messages = [...state.messages, event as TypedEvent<'message:received'>];
          break;
      }

      return newState;
    });
  },

  clearEvents: () => {
    set({
      lastEvent: null,
      sessionEvents: {
        created: [],
        deleted: [],
        updated: [],
      },
      messages: [],
    });
  },
}));

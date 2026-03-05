/**
 * 服务器事件 React Hooks
 * 提供在 React 组件中使用服务器推送事件的能力
 */

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { SSEClient, type EventMap } from '@littlething/sdk';
import { EventBus } from '@/lib/eventBus';

export type { EventMap };

export interface ServerEventOptions {
  sessionId?: string;
}

interface ServerEventContextValue {
  status: 'connected' | 'connecting' | 'disconnected';
  eventBus: EventBus<EventMap>;
}

const ServerEventContext = createContext<ServerEventContextValue | null>(null);

let globalSSEClient: SSEClient | null = null;
let globalEventBus: EventBus<EventMap> | null = null;
let globalStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
let globalStatusListeners: Set<(status: 'connected' | 'connecting' | 'disconnected') => void> = new Set();

function createSSEConnection(options?: ServerEventOptions): { client: SSEClient; eventBus: EventBus<EventMap> } {
  if (globalSSEClient && globalEventBus) {
    return { client: globalSSEClient, eventBus: globalEventBus };
  }

  const eventBus = new EventBus<EventMap>();
  globalEventBus = eventBus;

  const client = new SSEClient({ sessionId: options?.sessionId });
  globalSSEClient = client;
  globalStatus = 'connecting';
  globalStatusListeners.forEach(cb => cb(globalStatus));

  client.subscribeAll((event) => {
    eventBus.emit(event.type as keyof EventMap, event.payload);
  });

  client.connect().then(() => {
    globalStatus = 'connected';
    globalStatusListeners.forEach(cb => cb(globalStatus));
  }).catch((error) => {
    console.error('服务器事件连接失败:', error);
    globalStatus = 'disconnected';
    globalStatusListeners.forEach(cb => cb(globalStatus));
    globalSSEClient = null;
    globalEventBus = null;
  });

  return { client, eventBus };
}

export function ServerEventProvider({ 
  children, 
  options 
}: { 
  children: React.ReactNode; 
  options?: ServerEventOptions;
}) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>(globalStatus);
  const eventBusRef = useRef<EventBus<EventMap> | null>(globalEventBus);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const { eventBus } = createSSEConnection(options);
    eventBusRef.current = eventBus;

    globalStatusListeners.add(setStatus);

    return () => {
      globalStatusListeners.delete(setStatus);
    };
  }, [options?.sessionId]);

  const contextValue: ServerEventContextValue = {
    status,
    eventBus: eventBusRef.current || new EventBus<EventMap>(),
  };

  return (
    <ServerEventContext.Provider value={contextValue}>
      {children}
    </ServerEventContext.Provider>
  );
}

export function useServerEvent() {
  const context = useContext(ServerEventContext);
  if (!context) {
    throw new Error('useServerEvent must be used within a ServerEventProvider');
  }
  return context;
}

export function useOnEvent<K extends keyof EventMap>(
  eventType: K,
  callback: (payload: EventMap[K]) => void,
  deps: React.DependencyList = []
) {
  const { eventBus } = useServerEvent();

  useEffect(() => {
    return eventBus.on(eventType, callback);
  }, [eventBus, eventType, ...deps]);
}

export function useOnAllEvents(
  callback: (payload: unknown) => void,
  deps: React.DependencyList = []
) {
  const { eventBus } = useServerEvent();

  useEffect(() => {
    return eventBus.onAll(callback);
  }, [eventBus, ...deps]);
}

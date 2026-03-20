import type { SessionsGetResponse } from '@littlething/sdk';
import { MessageBubble } from './MessageBubble';
import { AgentStatus } from './AgentStatus';

type Message = SessionsGetResponse['session']['messages'][number];
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEffect, useRef } from 'react';

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
}

export function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">开始新对话...</p>
        </div>
        <AgentStatus />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-5">
          {messages.map((message, index) => (
            <MessageBubble 
              key={index} 
              message={message} 
              isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <AgentStatus />
    </div>
  );
}

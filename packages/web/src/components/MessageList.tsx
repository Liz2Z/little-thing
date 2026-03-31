import type { SessionsGetResponse } from "@littlething/sdk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { Streamdown } from "streamdown";
import type { AgentRunState } from "@/lib/agent-types";
import { AgentStatus } from "./AgentStatus";
import { MessageBubble } from "./MessageBubble";

type Message = SessionsGetResponse["session"]["messages"][number];

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MessageListProps {
  messages: Message[];
  isStreaming?: boolean;
  agentRunState?: AgentRunState | null;
}

export function MessageList({
  messages,
  isStreaming,
  agentRunState,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

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

  const hasStreamingContent = isStreaming && agentRunState?.content;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-5">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              isStreaming={
                isStreaming &&
                index === messages.length - 1 &&
                message.role === "assistant"
              }
            />
          ))}

          {/* 显示流式内容 */}
          {hasStreamingContent && (
            <div className="flex mb-4 justify-start">
              <div className="max-w-[80%] px-4 py-3 text-sm leading-relaxed bg-card text-foreground rounded-message-assistant border border-stone-200">
                <Streamdown plugins={{ code, math }} isAnimating={true}>
                  {agentRunState.content}
                </Streamdown>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <AgentStatus />
    </div>
  );
}

import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { Copy, GitFork, RotateCcw } from "lucide-react";
import { Streamdown } from "streamdown";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { type Message, useSessionStore } from "@/store/sessionStore";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const forkSession = useSessionStore((state) => state.forkSession);
  const resumeSession = useSessionStore((state) => state.resumeSession);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-[11px] text-stone-500 tracking-wide">
          {message.content}
        </span>
      </div>
    );
  }

  const handleFork = async () => {
    if (!activeSessionId || !message.id) return;
    try {
      await forkSession(activeSessionId, message.id);
    } catch (error) {
      console.error("Fork failed:", error);
    }
  };

  const handleResume = async () => {
    if (!activeSessionId || !message.id) return;
    try {
      await resumeSession(activeSessionId, message.id, message.content);
    } catch (error) {
      console.error("Resume failed:", error);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn("flex mb-4", isUser ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[80%] px-4 py-3 text-sm leading-relaxed",
              isUser
                ? "bg-primary-100 text-primary-900 rounded-message-user border border-primary-200"
                : "bg-card text-foreground rounded-message-assistant border border-stone-200",
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">
                {message.content}
              </p>
            ) : (
              <Streamdown
                plugins={{ code, math }}
                isAnimating={isStreaming && message.role === "assistant"}
              >
                {message.content}
              </Streamdown>
            )}
            <span
              className={cn(
                "text-[10px] mt-2 block tracking-wide",
                isUser ? "text-primary-700/60" : "text-stone-400",
              )}
            >
              {new Date(message.timestamp).toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleFork}>
          <GitFork className="mr-2 h-4 w-4" />
          从此分叉
        </ContextMenuItem>
        {isUser && (
          <ContextMenuItem onClick={handleResume}>
            <RotateCcw className="mr-2 h-4 w-4" />
            从此继续
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          复制内容
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

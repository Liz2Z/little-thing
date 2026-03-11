import type { Message } from '@/api/types';
import { cn } from '@/lib/utils';
import { Streamdown } from 'streamdown';
import { code } from '@streamdown/code';
import { math } from '@streamdown/math';


interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-[11px] text-stone-500 tracking-wide">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex mb-4', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary-100 text-primary-900 rounded-message-user border border-primary-200'
            : 'bg-card text-foreground rounded-message-assistant border border-stone-200'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Streamdown
            plugins={{ code, math }}
            isAnimating={isStreaming && message.role === 'assistant'}
          >
            {message.content}
          </Streamdown>
        )}
        <span
          className={cn(
            'text-[10px] mt-2 block tracking-wide',
            isUser ? 'text-primary-700/60' : 'text-stone-400'
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

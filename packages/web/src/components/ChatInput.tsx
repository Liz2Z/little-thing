import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CornerDownLeft } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex-shrink-0 px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            className="min-h-[52px] max-h-[200px] bg-stone-50 border-stone-200 focus:border-primary/50 focus:ring-0 rounded-2xl text-sm py-3.5 pl-4 pr-12 resize-none"
          />
          <Button
            type="submit"
            disabled={!message.trim() || disabled}
            size="sm"
            className="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-xl bg-primary hover:bg-primary-600 text-primary-foreground disabled:opacity-30"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
          <CornerDownLeft className="w-3 h-3 text-stone-300" />
          <span className="text-[10px] text-stone-300">Enter 发送</span>
        </div>
      </div>
    </form>
  );
}

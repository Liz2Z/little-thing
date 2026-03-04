import { useSessionStore } from '@/store/sessionStore';
import { SessionItem } from './SessionItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';

interface SessionListProps {
  onCreateSession: () => void;
  onClose?: () => void;
}

export function SessionList({ onCreateSession, onClose }: SessionListProps) {
  const { sessions, activeSessionId, setActiveSession, deleteSession, isLoading } = useSessionStore();

  const handleSessionClick = (id: string) => {
    setActiveSession(id);
    onClose?.();
  };

  return (
    <div className="w-full sm:w-72 h-full bg-card border-r border-stone-200 flex flex-col">
      {/* 头部 - 使用线条分割 */}
      <div className="p-4 border-b border-stone-200 flex justify-between items-center flex-shrink-0">
        <h2 className="font-semibold text-sm text-stone-600 hidden sm:block">会话列表</h2>
        <Button 
          onClick={onCreateSession} 
          size="sm"
          className="w-full sm:w-auto bg-primary hover:bg-primary-600 text-primary-foreground gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>新建</span>
        </Button>
      </div>

      {isLoading && sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-400 text-sm">加载中...</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          {sessions.length === 0 ? (
            <div className="p-8 text-center border-b border-stone-200">
              <p className="text-stone-400 text-sm mb-2">暂无会话</p>
              <p className="text-stone-300 text-xs">点击上方按钮创建新会话</p>
            </div>
          ) : (
            sessions.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onClick={() => handleSessionClick(session.id)}
                onDelete={deleteSession}
              />
            ))
          )}
        </ScrollArea>
      )}
    </div>
  );
}

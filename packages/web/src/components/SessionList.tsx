import { useSessionStore } from '@/store/sessionStore';
import { SessionItem } from './SessionItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

interface SessionListProps {
  onCreateSession: () => void;
  onClose?: () => void;
}

export function SessionList({ onCreateSession, onClose }: SessionListProps) {
  const { sessions, activeSessionId, deleteSession, isLoading } = useSessionStore();

  return (
    <div className="h-full bg-card rounded-xl border border-stone-200/60 flex flex-col overflow-hidden">
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-medium text-stone-600">会话</span>
          </div>
          <span className="text-xs text-stone-300">{sessions.length}</span>
        </div>
        <Button
          onClick={onCreateSession}
          variant="outline"
          size="sm"
          className="w-full border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-800 gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新建</span>
        </Button>
      </div>

      {isLoading && sessions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-stone-300 text-xs">加载中...</p>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-2 pb-2">
          {sessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-stone-300 text-xs">暂无会话</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  isActive={session.id === activeSessionId}
                  onClick={onClose}
                  onDelete={deleteSession}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      <div className="p-3 border-t border-stone-100 flex-shrink-0">
        <Link
          to="/settings"
          className="flex items-center gap-2 px-3 py-2 text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="text-sm">设置</span>
        </Link>
      </div>
    </div>
  );
}

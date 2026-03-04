import type { Session } from '@/api/types';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
}

export function SessionItem({ session, isActive, onClick, onDelete }: SessionItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`确定删除会话 "${session.name}" 吗？`)) {
      onDelete(session.id);
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group px-4 py-3.5 cursor-pointer transition-all duration-150',
        'border-b border-stone-200 last:border-b-0',
        isActive 
          ? 'bg-primary-50 border-l-[2px] border-l-primary border-r-0 border-t-0' 
          : 'border-l-0 border-l-transparent hover:bg-stone-100'
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-medium text-sm truncate',
            isActive ? 'text-primary-900' : 'text-stone-700'
          )}>
            {session.name}
          </h3>
          <p className="text-[11px] text-stone-400 mt-1.5 flex items-center gap-1.5">
            <span>{session.messageCount} 条消息</span>
            <span className="text-stone-300">·</span>
            <span>{new Date(session.updatedAt).toLocaleDateString('zh-CN', {
              month: 'short',
              day: 'numeric'
            })}</span>
          </p>
        </div>
        <button
          onClick={handleDelete}
          className={cn(
            'opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded',
            'text-stone-400 hover:text-destructive hover:bg-destructive/10'
          )}
          title="删除会话"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

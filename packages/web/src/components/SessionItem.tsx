import { Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Session } from "@/store/sessionStore";

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

export function SessionItem({
  session,
  isActive,
  onDelete,
  onClick,
}: SessionItemProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (confirm(`确定删除会话 "${session.name}" 吗？`)) {
      onDelete(session.id);
    }
  };

  return (
    <Link
      to={`/chat/${session.id}`}
      onClick={onClick}
      className={cn(
        "group block px-3 py-2.5 transition-all duration-150",
        "hover:bg-stone-100",
        isActive ? "bg-primary-50/70 rounded-lg" : "rounded-lg",
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              "text-sm truncate",
              isActive ? "text-primary-900 font-medium" : "text-stone-600",
            )}
          >
            {session.name}
          </h3>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {session.messageCount} 条消息
          </p>
        </div>
        <button
          onClick={handleDelete}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded",
            "text-stone-300 hover:text-destructive hover:bg-destructive/5",
          )}
          title="删除会话"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </Link>
  );
}

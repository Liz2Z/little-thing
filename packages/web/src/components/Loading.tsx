import { cn } from '@/lib/utils';

export function Loading() {
  return (
    <div className="flex justify-center items-center py-3 border-t border-stone-200">
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-400">AI 思考中</span>
        <div className="flex gap-1">
          <span 
            className={cn("w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce")} 
            style={{ animationDelay: '0ms' }} 
          />
          <span 
            className={cn("w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce")} 
            style={{ animationDelay: '150ms' }} 
          />
          <span 
            className={cn("w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce")} 
            style={{ animationDelay: '300ms' }} 
          />
        </div>
      </div>
    </div>
  );
}

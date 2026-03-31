import { Loader2 } from "lucide-react";

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-3 border-t border-stone-100">
      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
      <span className="text-xs text-stone-400">AI 思考中...</span>
    </div>
  );
}

import { Outlet, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      {/* 导航栏 - 使用线条分割 */}
      <nav className="bg-card border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-base font-semibold text-stone-700 tracking-tight">Agent Chat</h1>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" asChild className="sm:hidden text-stone-600">
              <Link to="/">聊天</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="text-stone-500 hover:text-primary hover:bg-primary-50">
              <Link to="/settings">设置</Link>
            </Button>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  );
}

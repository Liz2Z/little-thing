import { useEffect, useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { SessionList } from '@/components/SessionList';
import { MessageList } from '@/components/MessageList';
import { ChatInput } from '@/components/ChatInput';
import { Loading } from '@/components/Loading';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export function ChatPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const {
    sessions,
    activeSessionId,
    activeSessionMessages,
    isLoading,
    error,
    fetchSessions,
    createSession,
    setActiveSession,
    sendMessage,
    clearError,
  } = useSessionStore();

  useEffect(() => {
    const initialize = async () => {
      if (hasInitialized) return;
      await fetchSessions();
      setHasInitialized(true);
    };
    initialize();
  }, [hasInitialized, fetchSessions]);

  useEffect(() => {
    if (hasInitialized && !isLoading && sessions.length === 0) {
      handleCreateSession();
    }
  }, [hasInitialized, isLoading, sessions.length]);

  const handleCreateSession = async () => {
    try {
      const session = await createSession(
        `会话 ${new Date().toLocaleString('zh-CN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}`
      );
      setActiveSession(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!activeSessionId || isStreaming) return;
    setIsStreaming(true);
    clearError();
    try {
      for await (const _chunk of sendMessage(message)) {
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsStreaming(false);
    }
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return (
    <div className="h-screen bg-background overflow-hidden">
      {/* 移动端遮罩 */}
      {showSessions && (
        <div
          className="fixed inset-0 bg-stone-900/10 z-20 sm:hidden"
          onClick={() => setShowSessions(false)}
        />
      )}

      <div className="h-full flex overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={`${
            showSessions ? 'translate-x-0' : '-translate-x-full'
          } sm:translate-x-0 transition-transform duration-300 ease-out fixed sm:static inset-y-0 left-0 z-30 w-[280px] flex-shrink-0 h-full`}
        >
          <div className="h-full p-4 pr-0 sm:pr-2">
            <SessionList
              onCreateSession={handleCreateSession}
              onClose={() => setShowSessions(false)}
            />
          </div>
        </aside>

        {/* 主内容区 */}
        <main className="flex-1 flex flex-col min-w-0 h-full p-4 pl-2 sm:pl-4 overflow-hidden">
          {activeSessionId ? (
            <div className="h-full flex flex-col bg-card rounded-xl border border-stone-200/60 overflow-hidden">
              {/* 头部 - 移除新会话按钮 */}
              <header className="flex-shrink-0 px-5 py-3.5 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSessions(!showSessions)}
                    className="sm:hidden h-8 w-8 text-stone-400 hover:text-stone-600"
                  >
                    {showSessions ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </Button>
                  <div>
                    <h1 className="font-medium text-stone-800 text-sm">
                      {activeSession?.name || '新会话'}
                    </h1>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {activeSessionMessages.length} 条消息
                    </p>
                  </div>
                </div>
              </header>

              {/* 消息区域 - 可滚动 */}
              <div className="flex-1 overflow-hidden">
                <MessageList messages={activeSessionMessages} />
              </div>

              {/* 加载状态 */}
              {isStreaming && <Loading />}

              {/* 输入区域 */}
              <ChatInput onSend={handleSendMessage} disabled={isStreaming} />

              {/* 错误提示 */}
              {error && (
                <div className="bg-destructive/5 border-t border-destructive/10 px-5 py-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}
            </div>
          ) : (
            /* 空状态 */
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-stone-400 text-sm mb-4">选择或创建一个会话开始聊天</p>
                <Button
                  onClick={handleCreateSession}
                  className="bg-primary hover:bg-primary-600 text-primary-foreground"
                >
                  创建新会话
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

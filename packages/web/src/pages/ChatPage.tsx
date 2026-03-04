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
      const session = await createSession(`会话 ${new Date().toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
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

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden relative bg-background">
      {showSessions && (
        <div
          className="fixed inset-0 bg-stone-900/10 z-20 sm:hidden"
          onClick={() => setShowSessions(false)}
        />
      )}

      <div
        className={`${
          showSessions ? 'translate-x-0' : '-translate-x-full'
        } sm:translate-x-0 transition-transform duration-300 ease-out sm:transition-none absolute sm:relative z-30 h-full flex-shrink-0`}
      >
        <SessionList
          onCreateSession={handleCreateSession}
          onClose={() => setShowSessions(false)}
        />
      </div>

      <div className="flex-1 flex flex-col w-full min-w-0 overflow-hidden">
        {activeSessionId ? (
          <>
            {/* 头部 - 使用线条分割 */}
            <div className="bg-card border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center gap-3 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSessions(!showSessions)}
                className="sm:hidden h-9 w-9 text-stone-500 hover:text-primary hover:bg-primary-50"
                aria-label="Toggle sessions"
              >
                {showSessions ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
              <h2 className="font-medium text-stone-700 text-sm truncate">
                {sessions.find((s) => s.id === activeSessionId)?.name || '聊天'}
              </h2>
            </div>

            <MessageList messages={activeSessionMessages} />

            {isStreaming && <Loading />}

            <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-stone-400 text-sm mb-3">选择或创建一个会话开始聊天</p>
              <Button 
                onClick={handleCreateSession}
                className="bg-primary hover:bg-primary-600 text-primary-foreground"
              >
                创建新会话
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border-t border-destructive/20 px-4 py-2 flex-shrink-0">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

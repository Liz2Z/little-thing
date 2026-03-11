import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();

  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const activeSessionMessages = useSessionStore((state) => state.activeSessionMessages);
  const isLoading = useSessionStore((state) => state.isLoading);
  const error = useSessionStore((state) => state.error);
  const initialized = useSessionStore((state) => state.initialized);
  const initialize = useSessionStore((state) => state.initialize);
  const createSession = useSessionStore((state) => state.createSession);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const sendMessage = useSessionStore((state) => state.sendMessage);
  const clearError = useSessionStore((state) => state.clearError);

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
      navigate(`/chat/${session.id}`);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  useEffect(() => {
    if (!initialized || isLoading || sessions.length === 0) return;

    if (urlSessionId && sessions.some(s => s.id === urlSessionId)) {
      if (urlSessionId !== activeSessionId) {
        setActiveSession(urlSessionId);
      }
    } else {
      const firstSessionId = sessions[0].id;
      setActiveSession(firstSessionId);
      navigate(`/chat/${firstSessionId}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, isLoading, urlSessionId]);

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
      {showSessions && (
        <div
          className="fixed inset-0 bg-stone-900/10 z-20 sm:hidden"
          onClick={() => setShowSessions(false)}
        />
      )}

      <div className="h-full flex overflow-hidden">
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

        <main className="flex-1 flex flex-col min-w-0 h-full p-4 pl-2 sm:pl-4 overflow-hidden">
          {activeSessionId ? (
            <div className="h-full flex flex-col bg-card rounded-xl border border-stone-200/60 overflow-hidden">
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

              <div className="flex-1 overflow-hidden">
                <MessageList messages={activeSessionMessages} isStreaming={isStreaming} />
              </div>

              {isStreaming && <Loading />}

              <ChatInput onSend={handleSendMessage} disabled={isStreaming} />

              {error && (
                <div className="bg-destructive/5 border-t border-destructive/10 px-5 py-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}
            </div>
          ) : (
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

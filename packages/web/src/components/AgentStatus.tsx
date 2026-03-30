import { useSessionStore } from '@/store/sessionStore';
import { EventStatus, type ToolUseEvent } from '@/lib/agent-types';
import { Loader2, CheckCircle, XCircle, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

export function AgentStatus() {
  const agentRunState = useSessionStore((state) => state.agentRunState);
  const isAgentRunning = useSessionStore((state) => state.isAgentRunning);
  const abortAgent = useSessionStore((state) => state.abortAgent);

  if (!agentRunState && !isAgentRunning) return null;

  return (
    <div className="px-4 py-2 border-t border-stone-200/60 bg-stone-50/50">
      <div className="max-w-3xl mx-auto space-y-2">
        {agentRunState?.thinking && (
          <div className="text-xs text-stone-500 italic">
            💭 {agentRunState.thinking}
          </div>
        )}
        
        {agentRunState?.toolCalls && agentRunState.toolCalls.size > 0 && (
          <div className="space-y-1">
            {Array.from(agentRunState.toolCalls.values()).map((toolCall) => (
              <ToolCallItem key={toolCall.tool_use_id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {isAgentRunning && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Agent 运行中...</span>
            </div>
            <button
              onClick={abortAgent}
              className="text-xs text-red-500 hover:text-red-600 transition-colors"
            >
              终止
            </button>
          </div>
        )}

        {agentRunState?.status === 'completed' && agentRunState.usage && (
          <div className="text-[10px] text-stone-400 flex items-center gap-3">
            <span>✓ 完成</span>
            <span>迭代: {agentRunState.stop_reason}</span>
            <span>Tokens: {agentRunState.usage.input_tokens} → {agentRunState.usage.output_tokens}</span>
          </div>
        )}

        {agentRunState?.status === 'error' && (
          <div className="text-xs text-red-500">
            ❌ 错误: {agentRunState.error}
          </div>
        )}

        {agentRunState?.status === 'aborted' && (
          <div className="text-xs text-stone-500">
            🛑 已终止
          </div>
        )}
      </div>
    </div>
  );
}

interface ToolCallItemProps {
  toolCall: ToolUseEvent;
}

function ToolCallItem({ toolCall }: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusIcon = () => {
    switch (toolCall.status) {
      case EventStatus.Pending:
        return <Loader2 className="w-3 h-3 animate-spin text-blue-500" />;
      case EventStatus.Completed:
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case EventStatus.Failed:
        return <XCircle className="w-3 h-3 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (toolCall.status) {
      case EventStatus.Pending:
        return '执行中...';
      case EventStatus.Completed:
        return `${toolCall.duration_ms}ms`;
      case EventStatus.Failed:
        return '失败';
    }
  };

  return (
    <div className="bg-white rounded-md border border-stone-200/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <Wrench className="w-3 h-3 text-stone-400" />
          <span className="font-medium text-stone-700">{toolCall.tool_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-stone-400">{getStatusText()}</span>
          {expanded ? (
            <ChevronDown className="w-3 h-3 text-stone-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-stone-400" />
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="border-t border-stone-200/60 px-2 py-1.5 space-y-1">
          <div className="text-[10px]">
            <span className="text-stone-400">输入: </span>
            <code className="text-stone-600 bg-stone-100 px-1 rounded">
              {typeof toolCall.input === 'string' 
                ? toolCall.input 
                : JSON.stringify(toolCall.input)}
            </code>
          </div>
          {toolCall.result && (
            <div className="text-[10px]">
              <span className="text-stone-400">结果: </span>
              <code className="text-stone-600 bg-stone-100 px-1 rounded break-all">
                {toolCall.result.length > 200 
                  ? `${toolCall.result.slice(0, 200)}...` 
                  : toolCall.result}
              </code>
            </div>
          )}
          {toolCall.error && (
            <div className="text-[10px]">
              <span className="text-red-400">错误: </span>
              <code className="text-red-600 bg-red-50 px-1 rounded">
                {toolCall.error}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

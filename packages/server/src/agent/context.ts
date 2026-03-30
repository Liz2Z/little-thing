import { randomUUID } from "crypto";
import { z } from "zod";

/**
 * Agent 运行上下文数据（纯数据部分）
 *
 * 在 Agent 运行期间维护的状态信息，用于事件的 span 追踪和序号生成：
 * - run_id: 当次运行的唯一标识
 * - parent_span_id: 父 span（嵌套调用时使用）
 * - span_id: 当前 span 标识
 * - seq: 下一个事件将使用的序号
 * - iteration: 当前 LLM 调用轮次
 * - enabled_tools: 已启用的工具列表
 * - aborted: 是否已被中断
 */
export const AgentRunContextDataBaseSchema = z.object({
  run_id: z.string(),
  parent_span_id: z.string().nullable(),
  span_id: z.string(),
  seq: z.number(),
  iteration: z.number(),
  enabled_tools: z.array(z.string()),
  aborted: z.boolean(),
});

export type AgentRunContextData = z.infer<typeof AgentRunContextDataBaseSchema>;

/**
 * Agent 运行上下文（含行为方法）
 *
 * 在纯数据基础上扩展了运行时方法：
 * - nextSeq(): 递增并返回下一个事件序号
 * - createChildSpan(): 创建子 span 上下文（用于嵌套的工具调用追踪）
 * - abort(): 标记当前运行已被中断
 * - isAborted(): 检查运行是否已被中断
 */
export interface AgentRunContext extends AgentRunContextData {
  nextSeq(): number;
  createChildSpan(): AgentRunContext;
  abort(): void;
  isAborted(): boolean;
}

export function createAgentRunContext(
  enabled_tools: string[],
  parent_span_id: string | null = null,
  run_id?: string,
): AgentRunContext {
  const actual_run_id = run_id || `run_${randomUUID()}`;

  return {
    run_id: actual_run_id,
    span_id: `span_${randomUUID()}`,
    parent_span_id,
    seq: 0,
    iteration: 0,
    enabled_tools,
    aborted: false,

    nextSeq(): number {
      return ++this.seq;
    },

    createChildSpan(): AgentRunContext {
      return createAgentRunContext(
        this.enabled_tools,
        this.span_id,
        this.run_id,
      );
    },

    abort(): void {
      this.aborted = true;
    },

    isAborted(): boolean {
      return this.aborted;
    },
  };
}

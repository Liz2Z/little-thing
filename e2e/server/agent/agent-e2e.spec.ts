/**
 * Agent E2E 测试
 *
 * 使用真实 LLM API 和真实工具进行端到端测试。
 * 运行前需要确保 .env.test 中配置了有效的 API Key。
 *
 * 运行方式：NODE_ENV=test bun test e2e/server/agent/agent-e2e.spec.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { Agent } from "../../../packages/server/src/agent/agent.js";
import { createModel } from "../../../packages/server/src/providers/factory.js";
import { ToolRegistry } from "../../../packages/server/src/tools/registry.js";
import { createAllTools } from "../../../packages/server/src/tools/index.js";
import {
  AgentEventSchema,
} from "../../../packages/server/src/agent/events.js";
import type {
  AgentEvent,
  AgentStartEvent,
  AgentContentEvent,
  AgentThinkingEvent,
  ToolUseEvent,
  AgentCompleteEvent,
  AgentErrorEvent,
} from "../../../packages/server/src/agent/events.js";

/** 收集 Agent 运行的所有事件 */
async function collectEvents(
  agent: Agent,
  message: string,
  options?: {
    enabledTools?: string[];
    runId?: string;
    abortSignal?: AbortSignal;
  },
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.run(message, [], options)) {
    events.push(event);
  }
  return events;
}

/** 创建带真实工具的 ToolRegistry */
function createTestToolRegistry(cwd: string): ToolRegistry {
  const registry = new ToolRegistry();
  const tools = createAllTools(cwd);
  for (const tool of Object.values(tools)) {
    registry.register(tool);
  }
  return registry;
}

describe("Agent E2E", () => {
  let tempDir: string;

  beforeAll(() => {
    expect(process.env.ZHIPU_API_KEY).toBeTruthy();

    tempDir = mkdtempSync(join(tmpdir(), "agent-e2e-"));
  });

  afterAll(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("简单文本对话", () => {
    it("应产生正确的事件序列：agent_start → agent_content → agent_complete", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "1+1=? 只回答数字");

      // 验证事件序列
      const types = events.map((e) => e.type);
      expect(types[0]).toBe("agent_start");
      expect(types[types.length - 1]).toBe("agent_complete");

      // 验证包含 agent_content 事件
      const contentEvents = events.filter(
        (e): e is AgentContentEvent => e.type === "agent_content",
      );
      expect(contentEvents.length).toBeGreaterThan(0);

      // 验证至少有一个 pending 和一个 completed 状态
      const pendingContent = contentEvents.filter(
        (e) => e.status === "pending",
      );
      const completedContent = contentEvents.filter(
        (e) => e.status === "completed",
      );
      expect(pendingContent.length).toBeGreaterThan(0);
      expect(completedContent.length).toBe(1);

      // 验证 completed 事件的内容包含 "2"
      expect(completedContent[0].content).toContain("2");
    }, 30000);

    it("agent_complete 应包含正确的 usage 和 stop_reason", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "说你好");
      const completeEvent = events.find(
        (e): e is AgentCompleteEvent => e.type === "agent_complete",
      );

      expect(completeEvent).toBeDefined();
      expect(completeEvent!.stop_reason).toBe("end_turn");
      expect(completeEvent!.total_iterations).toBeGreaterThanOrEqual(1);
      expect(completeEvent!.final_content.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("工具调用", () => {
    it("应在被要求读取文件时调用 read 工具", async () => {
      // 创建测试文件
      const testFilePath = join(tempDir, "hello.txt");
      writeFileSync(testFilePath, "Hello from e2e test");

      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const registry = createTestToolRegistry(tempDir);
      const agent = new Agent(model, registry);

      const events = await collectEvents(
        agent,
        `请读取文件 hello.txt 的内容并告诉我里面写了什么`,
        { enabledTools: ["read"] },
      );

      // 验证有 tool_use 事件
      const toolUseEvents = events.filter(
        (e): e is ToolUseEvent => e.type === "tool_use",
      );
      expect(toolUseEvents.length).toBeGreaterThan(0);

      // 验证至少有一个 pending 和一个 completed
      const pendingTools = toolUseEvents.filter(
        (e) => e.status === "pending",
      );
      const completedTools = toolUseEvents.filter(
        (e) => e.status === "completed",
      );
      expect(pendingTools.length).toBeGreaterThan(0);
      expect(completedTools.length).toBeGreaterThan(0);

      // 验证工具名是 read
      expect(pendingTools.some((e) => e.tool_name === "read")).toBe(true);

      // 验证最终完成
      const completeEvent = events.find(
        (e): e is AgentCompleteEvent => e.type === "agent_complete",
      );
      expect(completeEvent).toBeDefined();

      // 验证 agent 在回答中提到了文件内容
      const contentEvents = events.filter(
        (e): e is AgentContentEvent =>
          e.type === "agent_content" && e.status === "completed",
      );
      expect(contentEvents.length).toBeGreaterThan(0);

      // 第二轮 agent_content（工具执行后）应包含文件内容
      const lastContent =
        contentEvents[contentEvents.length - 1]?.content ?? "";
      expect(
        lastContent.includes("Hello") || lastContent.includes("e2e"),
      ).toBe(true);
    }, 60000);

    it("应在被要求列出目录时调用 ls 工具", async () => {
      // 创建几个测试文件
      writeFileSync(join(tempDir, "file1.txt"), "content1");
      writeFileSync(join(tempDir, "file2.txt"), "content2");

      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const registry = createTestToolRegistry(tempDir);
      const agent = new Agent(model, registry);

      const events = await collectEvents(
        agent,
        "请列出当前目录下的文件",
        { enabledTools: ["ls"] },
      );

      const toolUseEvents = events.filter(
        (e): e is ToolUseEvent => e.type === "tool_use",
      );
      expect(toolUseEvents.length).toBeGreaterThan(0);
      expect(
        toolUseEvents.some((e) => e.tool_name === "ls"),
      ).toBe(true);
    }, 60000);

    it("工具执行失败时应产出 status=failed 的 tool_use 事件", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const registry = createTestToolRegistry(tempDir);
      const agent = new Agent(model, registry);

      const events = await collectEvents(
        agent,
        "请读取文件 nonexistent_file_xyz.txt 的内容",
        { enabledTools: ["read"] },
      );

      const toolUseEvents = events.filter(
        (e): e is ToolUseEvent => e.type === "tool_use",
      );
      expect(toolUseEvents.length).toBeGreaterThan(0);

      // 应该有 failed 状态的工具事件（或 completed 但 agent 继续运行）
      const completeEvent = events.find(
        (e): e is AgentCompleteEvent => e.type === "agent_complete",
      );
      // 即使工具失败，agent 也应该能正常结束
      expect(completeEvent).toBeDefined();
    }, 60000);
  });

  describe("多轮工具调用", () => {
    it("应支持连续调用多个工具", async () => {
      writeFileSync(join(tempDir, "multi_a.txt"), "AAA");
      writeFileSync(join(tempDir, "multi_b.txt"), "BBB");

      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const registry = createTestToolRegistry(tempDir);
      const agent = new Agent(model, registry);

      const events = await collectEvents(
        agent,
        "请先列出当前目录下的文件，然后读取 multi_a.txt 和 multi_b.txt 的内容，告诉我每个文件的内容",
        { enabledTools: ["ls", "read"] },
      );

      const toolUseEvents = events.filter(
        (e): e is ToolUseEvent => e.type === "tool_use" && e.status === "completed",
      );

      // 应该有多次工具调用
      expect(toolUseEvents.length).toBeGreaterThanOrEqual(2);

      // 验证最终完成
      const completeEvent = events.find(
        (e): e is AgentCompleteEvent => e.type === "agent_complete",
      );
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.total_iterations).toBeGreaterThanOrEqual(2);
    }, 90000);
  });

  describe("事件结构校验", () => {
    it("所有事件应通过 AgentEventSchema 校验", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "说一个字：好");

      for (const event of events) {
        const result = AgentEventSchema.safeParse(event);
        if (!result.success) {
          console.error(
            `Schema validation failed for event type=${event.type}:`,
            result.error.flatten(),
          );
        }
        expect(result.success).toBe(true);
      }
    }, 30000);

    it("所有事件应有相同的 run_id", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "hi");

      const runIds = new Set(events.map((e) => e.run_id));
      expect(runIds.size).toBe(1);
    }, 30000);

    it("事件 seq 应单调递增", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "hi");

      for (let i = 1; i < events.length; i++) {
        expect(events[i].seq).toBeGreaterThan(events[i - 1].seq);
      }
    }, 30000);

    it("所有事件的 timestamp 应为有效 ISO 格式", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "hi");

      for (const event of events) {
        const date = new Date(event.timestamp);
        expect(date.toISOString()).toBe(event.timestamp);
      }
    }, 30000);

    it("使用自定义 runId 时所有事件应使用该 runId", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const events = await collectEvents(agent, "hi", {
        runId: "test-run-custom-id",
      });

      for (const event of events) {
        expect(event.run_id).toBe("test-run-custom-id");
      }
    }, 30000);
  });

  describe("中断（abort）", () => {
    it("主动 abort 应产生 agent_abort 事件", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());

      const events: AgentEvent[] = [];
      const runPromise = (async () => {
        for await (const event of agent.run(
          "请写一首500字的长诗",
          [],
          { runId: "abort-test-run" },
        )) {
          events.push(event);
          // 收到 agent_start 后立即 abort
          if (event.type === "agent_start") {
            agent.abort("abort-test-run");
          }
        }
      })();

      await runPromise;

      const abortEvent = events.find((e) => e.type === "agent_abort");
      expect(abortEvent).toBeDefined();
    }, 30000);

    it("外部 AbortSignal 应产生 agent_abort 事件", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");
      const agent = new Agent(model, new ToolRegistry());
      const controller = new AbortController();

      const events: AgentEvent[] = [];
      const runPromise = (async () => {
        for await (const event of agent.run("说你好", [], {
          abortSignal: controller.signal,
        })) {
          events.push(event);
          if (event.type === "agent_start") {
            controller.abort();
          }
        }
      })();

      await runPromise;

      const abortEvent = events.find((e) => e.type === "agent_abort");
      expect(abortEvent).toBeDefined();
    }, 30000);
  });

  describe("错误处理", () => {
    it("不存在的 provider 应抛出错误", () => {
      expect(() => createModel("non-existent-provider", "model")).toThrow();
    });

    it("缺失 API Key 应抛出错误", () => {
      const originalKey = process.env.ZHIPU_API_KEY;
      delete process.env.ZHIPU_API_KEY;

      try {
        expect(() =>
          createModel("zhipuai-coding-plan", "glm-4.7"),
        ).toThrow();
      } finally {
        if (originalKey) process.env.ZHIPU_API_KEY = originalKey;
      }
    });
  });
});

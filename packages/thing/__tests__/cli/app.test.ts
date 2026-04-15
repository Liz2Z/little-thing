import { describe, expect, it } from "bun:test";
import { z } from "zod";
import type { AgentEvent } from "../../src/agent/events.js";
import type { RunEventEnvelope } from "../../src/ai/event-hub.js";
import { runCli } from "../../src/cli/app.js";
import type {
  CliContextOptions,
  CliSessionService,
  ThingSettings,
} from "../../src/cli/context.js";
import type { CliIO } from "../../src/cli/io.js";
import type { Message } from "../../src/session/message.js";
import type { Session, SessionMeta } from "../../src/session/session.schema.js";
import type { AnyTool } from "../../src/tools/types.js";

function createCaptureIO() {
  let stdout = "";
  let stderr = "";

  const io: CliIO = {
    out(text = "") {
      stdout += `${text}\n`;
    },
    err(text = "") {
      stderr += `${text}\n`;
    },
    write(text: string) {
      stdout += text;
    },
    writeError(text: string) {
      stderr += text;
    },
  };

  return {
    io,
    getStdout: () => stdout,
    getStderr: () => stderr,
  };
}

function createSettingsSnapshot(): ThingSettings {
  return {
    version: "1.0.0",
    llm: {
      provider: "demo-provider",
      model: "demo-model",
      baseUrl: "https://example.com",
      apiKey: "secret-key",
      timeout: 30_000,
      maxRetries: 3,
      thinkingEnabled: false,
      thinkingBudgetTokens: 16_000,
    },
    providers: {},
    server: {
      host: "localhost",
      port: 3000,
    },
    logging: {
      level: "info",
      format: "text",
    },
    prompts: {
      globalSystemPrompt: undefined,
      providers: {},
      models: {},
    },
    tools: {
      defaultAction: "allow",
      rules: [],
    },
    agent: {
      loopGuard: {
        enabled: true,
        windowSize: 6,
        maxRepeats: 3,
      },
    },
    ui: {},
  };
}

function createTool(name: string, description: string): AnyTool {
  return {
    name,
    label: name,
    description,
    parameters: z.object({}),
    execute: async () => ({
      content: [{ type: "text", text: "ok" }],
    }),
  };
}

class FakeSessionService implements CliSessionService {
  private readonly sessions = new Map<string, Session>();
  private runCounter = 0;
  public readonly abortCalls: string[] = [];
  public runEvents: RunEventEnvelope[] = [];
  public lastRun:
    | {
        sessionId: string;
        message: string;
        options?: {
          enabledTools?: string[];
          provider?: string;
          model?: string;
          systemPrompt?: string;
        };
      }
    | undefined;

  seedSession(session: Session) {
    this.sessions.set(session.meta.id, session);
  }

  listSessions(): SessionMeta[] {
    return Array.from(this.sessions.values())
      .map((session) => session.meta)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getSession(id: string): Session | null {
    return this.sessions.get(id) ?? null;
  }

  createSession(name?: string, provider?: string, model?: string): SessionMeta {
    const id = `session-${this.sessions.size + 1}`;
    const now = new Date("2026-04-15T12:00:00.000Z").toISOString();
    const meta: SessionMeta = {
      id,
      name: name ?? `会话-${this.sessions.size + 1}`,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      provider: provider ?? "demo-provider",
      model: model ?? "demo-model",
    };

    this.sessions.set(id, { meta, messages: [] });
    return meta;
  }

  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  renameSession(id: string, name: string): boolean {
    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    session.meta.name = name;
    session.meta.updatedAt = new Date("2026-04-15T12:30:00.000Z").toISOString();
    return true;
  }

  forkSession(
    sessionId: string,
    messageId: string,
    name?: string,
  ): SessionMeta | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const index = session.messages.findIndex(
      (message) => message.id === messageId,
    );
    if (index === -1) {
      return null;
    }

    const meta: SessionMeta = {
      id: `session-${this.sessions.size + 1}`,
      name: name ?? `${session.meta.name} (fork)`,
      createdAt: new Date("2026-04-15T13:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-04-15T13:00:00.000Z").toISOString(),
      messageCount: index + 1,
      parentSessionId: sessionId,
      forkedFromMessageId: messageId,
      provider: session.meta.provider,
      model: session.meta.model,
    };

    const forked: Session = {
      meta,
      messages: session.messages.slice(0, index + 1),
    };
    this.sessions.set(meta.id, forked);
    return meta;
  }

  resumeSession(sessionId: string, messageId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const index = session.messages.findIndex(
      (message) => message.id === messageId,
    );
    if (index === -1) {
      return false;
    }

    session.messages = session.messages.slice(0, index);
    session.meta.messageCount = session.messages.length;
    session.meta.updatedAt = new Date("2026-04-15T14:00:00.000Z").toISOString();
    return true;
  }

  startRun(
    sessionId: string,
    message: string,
    options?: {
      enabledTools?: string[];
      provider?: string;
      model?: string;
      systemPrompt?: string;
    },
  ): string {
    this.runCounter += 1;
    this.lastRun = { sessionId, message, options };
    return `run-${this.runCounter}`;
  }

  async *subscribeRunEvents(): AsyncGenerator<RunEventEnvelope> {
    for (const event of this.runEvents) {
      yield event;
    }
  }

  abort(runId: string): boolean {
    this.abortCalls.push(runId);
    return true;
  }
}

function createSeedSession(): Session {
  const messages: Message[] = [
    {
      id: "msg-1",
      role: "user",
      content: { type: "text", text: "hello world" },
      timestamp: "2026-04-15T10:00:00.000Z",
    },
    {
      id: "msg-2",
      role: "assistant",
      content: { type: "text", text: "hi there" },
      timestamp: "2026-04-15T10:00:01.000Z",
    },
  ];

  return {
    meta: {
      id: "session-1",
      name: "Seed Session",
      createdAt: "2026-04-15T10:00:00.000Z",
      updatedAt: "2026-04-15T10:00:01.000Z",
      messageCount: messages.length,
      provider: "demo-provider",
      model: "demo-model",
    },
    messages,
  };
}

async function executeCli(
  args: string[],
  overrides: Partial<CliContextOptions> = {},
) {
  const capture = createCaptureIO();
  const exitCode = await runCli(["bun", "thing", ...args], {
    io: capture.io,
    settingsSnapshot: createSettingsSnapshot(),
    settingsPaths: {
      global: "/tmp/global-settings.json",
      credentials: "/tmp/credentials.json",
      local: "/tmp/local-settings.json",
    },
    knownProviders: [
      {
        id: "demo-provider",
        name: "Demo Provider",
        api: "https://example.com",
        env: ["DEMO_API_KEY"],
        npm: "@ai-sdk/openai-compatible",
        modelCount: 2,
      },
    ],
    tools: [
      createTool("read", "Read the contents of a file"),
      createTool("write", "Write content to a file"),
    ],
    loadProviderModels: async () => [
      {
        id: "demo-model",
        object: "model",
        owned_by: "demo",
        created: 123,
      },
    ],
    ...overrides,
  });

  return {
    exitCode,
    stdout: capture.getStdout(),
    stderr: capture.getStderr(),
  };
}

function createEvent(
  event: Omit<
    AgentEvent,
    "run_id" | "seq" | "span_id" | "parent_span_id" | "timestamp"
  > &
    Partial<
      Pick<
        AgentEvent,
        "run_id" | "seq" | "span_id" | "parent_span_id" | "timestamp"
      >
    >,
): AgentEvent {
  return {
    run_id: "run-1",
    seq: 1,
    span_id: "span-1",
    parent_span_id: null,
    timestamp: "2026-04-15T15:00:00.000Z",
    ...event,
  } as AgentEvent;
}

describe("thing CLI", () => {
  it("keeps the default TUI placeholder command", async () => {
    const result = await executeCli([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TUI is under construction");
  });

  it("shows config and system information", async () => {
    const configResult = await executeCli(["config", "show"]);
    const pathsResult = await executeCli(["config", "paths"]);
    const healthResult = await executeCli(["system", "health"]);

    expect(configResult.stdout).toContain('"provider": "demo-provider"');
    expect(configResult.stdout).toContain('"apiKey": "***"');
    expect(pathsResult.stdout).toContain("scope");
    expect(pathsResult.stdout).toContain("credentials");
    expect(healthResult.stdout).toContain("status: ok");
    expect(healthResult.stdout).toContain("model: demo-model");
  });

  it("lists providers, provider models, and tools", async () => {
    const providerList = await executeCli(["providers", "list"]);
    const providerModels = await executeCli([
      "providers",
      "models",
      "demo-provider",
    ]);
    const toolsList = await executeCli(["tools", "list"]);

    expect(providerList.stdout).toContain("demo-provider");
    expect(providerModels.stdout).toContain("provider: demo-provider");
    expect(providerModels.stdout).toContain("demo-model");
    expect(toolsList.stdout).toContain("read");
    expect(toolsList.stdout).toContain("write");
  });

  it("supports session lifecycle commands", async () => {
    const sessionService = new FakeSessionService();
    const seedSession = createSeedSession();
    sessionService.seedSession(seedSession);

    const listResult = await executeCli(["sessions", "list"], {
      sessionService,
    });
    const createResult = await executeCli(
      [
        "sessions",
        "create",
        "My Session",
        "--provider",
        "other-provider",
        "--model",
        "other-model",
      ],
      { sessionService },
    );
    const showResult = await executeCli(
      ["sessions", "show", seedSession.meta.id],
      { sessionService },
    );
    const renameResult = await executeCli(
      ["sessions", "rename", seedSession.meta.id, "Renamed"],
      { sessionService },
    );
    const forkResult = await executeCli(
      ["sessions", "fork", seedSession.meta.id, "msg-1", "Forked"],
      { sessionService },
    );
    const resumeResult = await executeCli(
      ["sessions", "resume", seedSession.meta.id, "msg-2"],
      { sessionService },
    );
    const deleteResult = await executeCli(
      ["sessions", "delete", seedSession.meta.id],
      { sessionService },
    );

    expect(listResult.stdout).toContain(seedSession.meta.id);
    expect(createResult.stdout).toContain("created: ok");
    expect(createResult.stdout).toContain("other-provider");
    expect(showResult.stdout).toContain("messages:");
    expect(showResult.stdout).toContain("hello world");
    expect(renameResult.stdout).toContain("renamed: ok");
    expect(forkResult.stdout).toContain("forked: ok");
    expect(resumeResult.stdout).toContain("resumed: ok");
    expect(deleteResult.stdout).toContain(`deleted: ${seedSession.meta.id}`);
  });

  it("renders a foreground run with streaming events", async () => {
    const sessionService = new FakeSessionService();
    sessionService.seedSession(createSeedSession());
    sessionService.runEvents = [
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "agent_start",
          message: "Ship it",
          enabled_tools: ["read"],
        }),
      },
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "agent_thinking",
          status: "pending",
          content: "thinking",
          iteration: 1,
        }),
      },
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "agent_content",
          status: "pending",
          content: "Hello from the agent",
          iteration: 1,
        }),
      },
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "tool_use",
          status: "pending",
          tool_use_id: "tool-1",
          tool_name: "read",
          input: { path: "README.md" },
          iteration: 1,
        }),
      },
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "tool_use",
          status: "completed",
          tool_use_id: "tool-1",
          tool_name: "read",
          input: { path: "README.md" },
          result: "README contents",
          duration_ms: 12,
          iteration: 1,
        }),
      },
      {
        run_id: "run-1",
        session_id: "session-1",
        event: createEvent({
          type: "agent_complete",
          final_content: "Hello from the agent",
          total_iterations: 1,
          stop_reason: "end_turn",
          usage: {
            input_tokens: 10,
            output_tokens: 20,
          },
        }),
      },
    ];

    const result = await executeCli(
      ["run", "session-1", "--message", "Ship it", "--tool", "read"],
      { sessionService },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("run_id: run-1");
    expect(result.stdout).toContain("provider: demo-provider");
    expect(result.stdout).toContain("enabled_tools: read");
    expect(result.stdout).toContain("Hello from the agent");
    expect(result.stdout).toContain("[tool:read] completed in 12ms");
    expect(result.stdout).toContain("usage: input=10 output=20");
    expect(sessionService.lastRun).toEqual({
      sessionId: "session-1",
      message: "Ship it",
      options: {
        enabledTools: ["read"],
        provider: "demo-provider",
        model: "demo-model",
        systemPrompt: undefined,
      },
    });
  });

  it("shows command help when required run options are missing", async () => {
    const sessionService = new FakeSessionService();
    sessionService.seedSession(createSeedSession());

    const result = await executeCli(["run", "session-1"], { sessionService });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("CLI:INVALID_USAGE");
    expect(result.stdout).toContain("run <sessionId>");
  });

  it("shows command help when required run position args are missing", async () => {
    const result = await executeCli(["run", "--message", "nihao"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("CLI:INVALID_USAGE");
    expect(result.stderr).toContain("缺少必填位置参数");
    expect(result.stdout).toContain("run <sessionId>");
  });

  it("reports not found errors through the CLI error handler", async () => {
    const result = await executeCli(["sessions", "show", "missing-session"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("CLI:SESSION_NOT_FOUND");
    expect(result.stderr).toContain("会话不存在");
  });
});

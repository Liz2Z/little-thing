import { existsSync } from "node:fs";
import type { AgentEvent } from "../../agent/events.js";
import type { KnownProviderSummary } from "../../providers/index.js";
import type { Message } from "../../session/message.js";
import type { Session, SessionMeta } from "../../session/session.schema.js";
import type { SettingsPaths } from "../../settings/index.js";
import type { AnyTool } from "../../tools/types.js";
import type { ThingSettings } from "../context.js";
import type { CliIO } from "../io.js";

function truncate(text: string, max = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 1)}…`;
}

function padTable(rows: string[][]): string[] {
  if (rows.length === 0) {
    return [];
  }

  const widths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex]?.length ?? 0)),
  );

  return rows.map((row) =>
    row
      .map((cell, columnIndex) => cell.padEnd(widths[columnIndex]))
      .join("  ")
      .trimEnd(),
  );
}

function summarizeMessage(message: Message): string {
  switch (message.content.type) {
    case "text":
      return truncate(message.content.text, 96);
    case "tool_use":
      return `tool:${message.content.name} ${truncate(
        JSON.stringify(message.content.input),
        72,
      )}`;
    case "tool_result":
      return `${message.content.is_error ? "tool-error" : "tool-result"}:${
        message.content.tool_name
      } ${truncate(message.content.content, 72)}`;
  }
}

function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key.toLowerCase().includes("apikey")) {
        result[key] = entry ? "***" : entry;
        continue;
      }
      result[key] = redactSecrets(entry);
    }
    return result;
  }

  return value;
}

export function renderConfigShow(settingsSnapshot: ThingSettings): string {
  return JSON.stringify(redactSecrets(settingsSnapshot), null, 2);
}

export function renderConfigPaths(settingsPaths: SettingsPaths): string {
  const rows = [
    ["scope", "path", "exists"],
    [
      "global",
      settingsPaths.global,
      existsSync(settingsPaths.global) ? "yes" : "no",
    ],
    [
      "credentials",
      settingsPaths.credentials,
      existsSync(settingsPaths.credentials) ? "yes" : "no",
    ],
    [
      "local",
      settingsPaths.local,
      existsSync(settingsPaths.local) ? "yes" : "no",
    ],
  ];

  return padTable(rows).join("\n");
}

export function renderSystemHealth(settingsSnapshot: ThingSettings): string {
  return [
    "status: ok",
    `provider: ${settingsSnapshot.llm.provider}`,
    `model: ${settingsSnapshot.llm.model}`,
  ].join("\n");
}

export function renderSystemConfig(settingsSnapshot: ThingSettings): string {
  return [
    `provider: ${settingsSnapshot.llm.provider}`,
    `model: ${settingsSnapshot.llm.model}`,
    `server: http://${settingsSnapshot.server.host}:${settingsSnapshot.server.port}`,
    `tools.defaultAction: ${settingsSnapshot.tools.defaultAction}`,
    `logging.level: ${settingsSnapshot.logging.level}`,
  ].join("\n");
}

export function renderProvidersList(providers: KnownProviderSummary[]): string {
  const rows = [
    ["id", "name", "models", "env", "sdk"],
    ...providers.map((provider) => [
      provider.id,
      provider.name,
      String(provider.modelCount),
      provider.env.join(","),
      provider.npm.replace("@ai-sdk/", ""),
    ]),
  ];

  return padTable(rows).join("\n");
}

export function renderProviderModels(
  providerId: string,
  models: Array<{
    id: string;
    object?: string;
    created?: number;
    owned_by?: string;
  }>,
): string {
  const rows = [
    ["id", "owner", "created"],
    ...models.map((model) => [
      model.id,
      model.owned_by ?? "-",
      model.created ? String(model.created) : "-",
    ]),
  ];

  return [`provider: ${providerId}`, padTable(rows).join("\n")].join("\n");
}

export function renderToolsList(tools: AnyTool[]): string {
  const rows = [
    ["name", "label", "description"],
    ...tools
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((tool) => [tool.name, tool.label, truncate(tool.description, 96)]),
  ];

  return padTable(rows).join("\n");
}

export function renderSessionsList(sessions: SessionMeta[]): string {
  const rows = [
    ["id", "name", "provider", "model", "messages", "updatedAt"],
    ...sessions.map((session) => [
      session.id,
      session.name,
      session.provider ?? "-",
      session.model ?? "-",
      String(session.messageCount),
      session.updatedAt,
    ]),
  ];

  return padTable(rows).join("\n");
}

export function renderSessionDetails(session: Session): string {
  const header = [
    `id: ${session.meta.id}`,
    `name: ${session.meta.name}`,
    `provider: ${session.meta.provider ?? "-"}`,
    `model: ${session.meta.model ?? "-"}`,
    `messages: ${session.meta.messageCount}`,
    `createdAt: ${session.meta.createdAt}`,
    `updatedAt: ${session.meta.updatedAt}`,
  ];

  if (session.meta.parentSessionId) {
    header.push(`parentSessionId: ${session.meta.parentSessionId}`);
  }

  if (session.meta.forkedFromMessageId) {
    header.push(`forkedFromMessageId: ${session.meta.forkedFromMessageId}`);
  }

  if (session.messages.length === 0) {
    return [...header, "", "messages:", "(empty)"].join("\n");
  }

  const messageRows = [
    ["messageId", "role", "timestamp", "summary"],
    ...session.messages.map((message) => [
      message.id,
      message.role,
      message.timestamp,
      summarizeMessage(message),
    ]),
  ];

  return [...header, "", "messages:", padTable(messageRows).join("\n")].join(
    "\n",
  );
}

export function renderMutationResult(
  subject: string,
  meta: SessionMeta,
): string {
  return [
    `${subject}: ok`,
    `id: ${meta.id}`,
    `name: ${meta.name}`,
    `provider: ${meta.provider ?? "-"}`,
    `model: ${meta.model ?? "-"}`,
  ].join("\n");
}

export interface RunRenderMetadata {
  runId: string;
  provider: string;
  model: string;
  enabledTools: string[];
}

interface RunRenderState {
  contentLineOpen: boolean;
  thinkingIterations: Set<number>;
  headerPrinted: boolean;
}

function summarizeToolText(value?: string): string {
  if (!value) {
    return "-";
  }
  return truncate(value, 96);
}

export function createRunEventRenderer(io: CliIO, metadata: RunRenderMetadata) {
  const state: RunRenderState = {
    contentLineOpen: false,
    thinkingIterations: new Set(),
    headerPrinted: false,
  };

  const ensureNewline = () => {
    if (state.contentLineOpen) {
      io.out();
      state.contentLineOpen = false;
    }
  };

  return {
    render(event: AgentEvent) {
      switch (event.type) {
        case "agent_start":
          if (!state.headerPrinted) {
            io.out(`run_id: ${metadata.runId}`);
            io.out(`provider: ${metadata.provider}`);
            io.out(`model: ${metadata.model}`);
            io.out(
              `enabled_tools: ${
                metadata.enabledTools.length > 0
                  ? metadata.enabledTools.join(", ")
                  : "(none)"
              }`,
            );
            io.out();
            state.headerPrinted = true;
          }
          return;

        case "agent_thinking":
          if (
            event.status === "pending" &&
            !state.thinkingIterations.has(event.iteration)
          ) {
            ensureNewline();
            io.out(`[thinking] iteration ${event.iteration}`);
            state.thinkingIterations.add(event.iteration);
          }
          return;

        case "agent_content":
          if (event.status === "pending") {
            io.write(event.content);
            state.contentLineOpen = true;
            return;
          }
          return;

        case "tool_use":
          ensureNewline();
          if (event.status === "pending") {
            io.out(
              `[tool:${event.tool_name}] running ${truncate(
                JSON.stringify(event.input),
                72,
              )}`,
            );
            return;
          }

          if (event.status === "completed") {
            io.out(
              `[tool:${event.tool_name}] completed in ${
                event.duration_ms ?? 0
              }ms ${summarizeToolText(event.result)}`,
            );
            return;
          }

          io.out(
            `[tool:${event.tool_name}] failed in ${
              event.duration_ms ?? 0
            }ms ${summarizeToolText(event.error)}`,
          );
          return;

        case "agent_complete":
          ensureNewline();
          io.out();
          io.out(
            `completed: iterations=${event.total_iterations} stop_reason=${event.stop_reason}`,
          );
          if (event.usage) {
            io.out(
              `usage: input=${event.usage.input_tokens} output=${event.usage.output_tokens}`,
            );
          }
          return;

        case "agent_error":
          ensureNewline();
          io.err(`agent_error: ${event.error}`);
          return;

        case "agent_abort":
          ensureNewline();
          io.err(`agent_abort: ${event.reason}`);
          return;
      }
    },
  };
}

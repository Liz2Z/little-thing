import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import { CommandUsageError, SessionNotFoundError } from "../errors.js";
import { createRunEventRenderer } from "../renderers/text.js";

function normalizeTools(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

interface RunOptions {
  message?: string;
  provider?: string;
  model?: string;
  tool?: string | string[];
  systemPrompt?: string;
}

export function registerRunCommand(cli: CAC, context: CliContext) {
  return cli
    .command("run <sessionId>", "Run the agent against a session")
    .option("--message <message>", "User message to send")
    .option("--provider <provider>", "Override provider")
    .option("--model <model>", "Override model")
    .option("--tool <tool>", "Enable a specific tool, repeatable")
    .option("--system-prompt <prompt>", "Runtime system prompt")
    .action(async (sessionId: string, options: RunOptions) => {
      if (!options.message) {
        throw new CommandUsageError("run", "缺少必填参数 --message");
      }

      const session = context.sessionService.getSession(sessionId);
      if (!session) {
        throw new SessionNotFoundError(sessionId);
      }

      const provider =
        options.provider ??
        session.meta.provider ??
        context.settingsSnapshot.llm.provider;
      const model =
        options.model ??
        session.meta.model ??
        context.settingsSnapshot.llm.model;
      const enabledTools = normalizeTools(options.tool);

      const runId = context.sessionService.startRun(
        sessionId,
        options.message,
        {
          enabledTools: enabledTools.length > 0 ? enabledTools : undefined,
          provider,
          model,
          systemPrompt: options.systemPrompt,
        },
      );

      const renderer = createRunEventRenderer(context.io, {
        runId,
        provider,
        model,
        enabledTools,
      });

      let abortRequested = false;
      const onSigint = () => {
        if (abortRequested) {
          return;
        }
        abortRequested = true;
        context.io.err("interrupt received, aborting run...");
        context.sessionService.abort(runId);
      };

      process.once("SIGINT", onSigint);

      try {
        for await (const envelope of context.sessionService.subscribeRunEvents(
          runId,
          {
            replay: true,
          },
        )) {
          renderer.render(envelope.event);

          if (
            envelope.event.type === "agent_complete" ||
            envelope.event.type === "agent_error" ||
            envelope.event.type === "agent_abort"
          ) {
            return;
          }
        }
      } finally {
        process.removeListener("SIGINT", onSigint);
      }
    });
}

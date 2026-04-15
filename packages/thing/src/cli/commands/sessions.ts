import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import {
  CommandUsageError,
  MessageNotFoundError,
  SessionNotFoundError,
} from "../errors.js";
import {
  renderMutationResult,
  renderSessionDetails,
  renderSessionsList,
} from "../renderers/text.js";

function requireSession(context: CliContext, sessionId: string) {
  const session = context.sessionService.getSession(sessionId);
  if (!session) {
    throw new SessionNotFoundError(sessionId);
  }
  return session;
}

export function registerSessionCommands(cli: CAC, context: CliContext) {
  return cli
    .command(
      "sessions <action> [arg1] [arg2] [arg3]",
      "Manage persistent sessions",
    )
    .usage("sessions <list|create|show|rename|delete|fork|resume> [args...]")
    .option("--provider <provider>", "Override provider")
    .option("--model <model>", "Override model")
    .action(
      (
        action: string,
        arg1: string | undefined,
        arg2: string | undefined,
        arg3: string | undefined,
        options: { provider?: string; model?: string },
      ) => {
        switch (action) {
          case "list":
            context.io.out(
              renderSessionsList(context.sessionService.listSessions()),
            );
            return;

          case "create": {
            const session = context.sessionService.createSession(
              arg1,
              options.provider,
              options.model,
            );
            context.io.out(renderMutationResult("created", session));
            return;
          }

          case "show": {
            if (!arg1) {
              throw new CommandUsageError(
                "sessions",
                "sessions show 缺少 sessionId",
              );
            }
            context.io.out(renderSessionDetails(requireSession(context, arg1)));
            return;
          }

          case "rename": {
            if (!arg1 || !arg2) {
              throw new CommandUsageError(
                "sessions",
                "sessions rename 缺少 sessionId 或 name",
              );
            }

            if (!context.sessionService.renameSession(arg1, arg2)) {
              throw new SessionNotFoundError(arg1);
            }

            context.io.out(
              renderMutationResult(
                "renamed",
                requireSession(context, arg1).meta,
              ),
            );
            return;
          }

          case "delete":
            if (!arg1) {
              throw new CommandUsageError(
                "sessions",
                "sessions delete 缺少 sessionId",
              );
            }

            if (!context.sessionService.deleteSession(arg1)) {
              throw new SessionNotFoundError(arg1);
            }

            context.io.out(`deleted: ${arg1}`);
            return;

          case "fork": {
            if (!arg1 || !arg2) {
              throw new CommandUsageError(
                "sessions",
                "sessions fork 缺少 sessionId 或 messageId",
              );
            }

            const existing = requireSession(context, arg1);
            const session = context.sessionService.forkSession(
              arg1,
              arg2,
              arg3,
            );

            if (!session) {
              const hasMessage = existing.messages.some(
                (message) => message.id === arg2,
              );
              if (!hasMessage) {
                throw new MessageNotFoundError(arg1, arg2);
              }
              throw new SessionNotFoundError(arg1);
            }

            context.io.out(renderMutationResult("forked", session));
            return;
          }

          case "resume": {
            if (!arg1 || !arg2) {
              throw new CommandUsageError(
                "sessions",
                "sessions resume 缺少 sessionId 或 messageId",
              );
            }

            const existing = requireSession(context, arg1);
            const resumed = context.sessionService.resumeSession(arg1, arg2);

            if (!resumed) {
              const hasMessage = existing.messages.some(
                (message) => message.id === arg2,
              );
              if (!hasMessage) {
                throw new MessageNotFoundError(arg1, arg2);
              }
              throw new SessionNotFoundError(arg1);
            }

            context.io.out(
              renderMutationResult(
                "resumed",
                requireSession(context, arg1).meta,
              ),
            );
            return;
          }

          default:
            throw new CommandUsageError(
              "sessions",
              `不支持的 sessions 子命令: ${action}`,
            );
        }
      },
    );
}

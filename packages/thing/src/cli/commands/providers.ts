import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import { CommandUsageError } from "../errors.js";
import {
  renderProviderModels,
  renderProvidersList,
} from "../renderers/text.js";

export function registerProviderCommands(cli: CAC, context: CliContext) {
  return cli
    .command(
      "providers <action> [providerId]",
      "Inspect provider metadata and models",
    )
    .usage("providers <list|models> [providerId]")
    .action(async (action: string, providerId?: string) => {
      switch (action) {
        case "list":
          context.io.out(renderProvidersList(context.knownProviders));
          return;

        case "models":
          if (!providerId) {
            throw new CommandUsageError(
              "providers",
              "providers models 缺少 providerId",
            );
          }

          context.io.out(
            renderProviderModels(
              providerId,
              await context.loadProviderModels(providerId),
            ),
          );
          return;

        default:
          throw new CommandUsageError(
            "providers",
            `不支持的 providers 子命令: ${action}`,
          );
      }
    });
}

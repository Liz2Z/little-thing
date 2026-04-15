import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import { CommandUsageError } from "../errors.js";
import { renderSystemConfig, renderSystemHealth } from "../renderers/text.js";

export function registerSystemCommands(cli: CAC, context: CliContext) {
  return cli
    .command("system <action>", "Inspect local system state")
    .usage("system <health|config>")
    .action((action: string) => {
      switch (action) {
        case "health":
          context.io.out(renderSystemHealth(context.settingsSnapshot));
          return;

        case "config":
          context.io.out(renderSystemConfig(context.settingsSnapshot));
          return;

        default:
          throw new CommandUsageError(
            "system",
            `不支持的 system 子命令: ${action}`,
          );
      }
    });
}

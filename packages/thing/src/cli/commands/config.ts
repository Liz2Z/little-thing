import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import { CommandUsageError } from "../errors.js";
import { renderConfigPaths, renderConfigShow } from "../renderers/text.js";

export function registerConfigCommands(cli: CAC, context: CliContext) {
  return cli
    .command("config <action>", "Inspect little-thing config")
    .usage("config <show|paths>")
    .action((action: string) => {
      switch (action) {
        case "show":
          context.io.out(renderConfigShow(context.settingsSnapshot));
          return;

        case "paths":
          context.io.out(renderConfigPaths(context.settingsPaths));
          return;

        default:
          throw new CommandUsageError(
            "config",
            `不支持的 config 子命令: ${action}`,
          );
      }
    });
}

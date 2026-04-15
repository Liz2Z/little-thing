import type { CAC } from "cac";
import type { CliContext } from "../context.js";
import { CommandUsageError } from "../errors.js";
import { renderToolsList } from "../renderers/text.js";

export function registerToolCommands(cli: CAC, context: CliContext) {
  return cli
    .command("tools <action>", "Inspect built-in tools")
    .usage("tools <list>")
    .action((action: string) => {
      switch (action) {
        case "list":
          context.io.out(renderToolsList(context.tools));
          return;

        default:
          throw new CommandUsageError(
            "tools",
            `不支持的 tools 子命令: ${action}`,
          );
      }
    });
}

import { type CAC, cac } from "cac";
import { AppError } from "../lib/error.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerProviderCommands } from "./commands/providers.js";
import { registerRunCommand } from "./commands/run.js";
import { registerSessionCommands } from "./commands/sessions.js";
import { registerSystemCommands } from "./commands/system.js";
import { registerToolCommands } from "./commands/tools.js";
import {
  type CliContext,
  type CliContextOptions,
  createCliContext,
} from "./context.js";
import { CliUnhandledError, CommandUsageError } from "./errors.js";

export interface CliAppOptions extends CliContextOptions {
  startServer?: () => unknown | Promise<unknown>;
}

export interface CliApp {
  cli: CAC;
  context: CliContext;
  helpPrinters: Map<string, () => void>;
}

function isCacError(error: unknown): error is Error {
  return error instanceof Error && error.name === "CACError";
}

function normalizeCliUsageMessage(message: string): string {
  if (message.startsWith("missing required args for command")) {
    return "缺少必填位置参数";
  }

  if (message.startsWith("Unused args:")) {
    return `存在多余参数: ${message.slice("Unused args:".length).trim()}`;
  }

  if (message.startsWith("Unknown option")) {
    return `未知参数: ${message.slice("Unknown option".length).trim()}`;
  }

  if (message.startsWith("option ")) {
    return `参数值缺失: ${message}`;
  }

  return message;
}

function printCommandHelp(
  command: {
    rawName: string;
    usageText?: string;
    description: string;
    options: Array<{ rawName: string; description: string }>;
  },
  context: CliContext,
) {
  const usage = command.usageText || command.rawName;
  context.io.out("Usage:");
  context.io.out(`  $ thing ${usage}`);

  if (command.description) {
    context.io.out();
    context.io.out(command.description);
  }

  if (command.options.length > 0) {
    context.io.out();
    context.io.out("Options:");
    for (const option of command.options) {
      context.io.out(`  ${option.rawName}  ${option.description}`);
    }
  }
}

function registerCommandHelp(
  helpPrinters: Map<string, () => void>,
  key: string,
  command: {
    rawName: string;
    usageText?: string;
    description: string;
    options: Array<{ rawName: string; description: string }>;
  },
  context: CliContext,
) {
  helpPrinters.set(key, () => {
    printCommandHelp(command, context);
  });
}

export function createCliApp(options: CliAppOptions = {}): CliApp {
  const cli = cac("thing");
  const context = createCliContext(options);
  const helpPrinters = new Map<string, () => void>();

  const serverCommand = cli
    .command("server", "Start the little-thing server")
    .action(async () => {
      context.io.out("Starting little-thing server...");

      if (options.startServer) {
        await options.startServer();
        return;
      }

      const { startServer } = await import("../server");
      startServer();
    });
  registerCommandHelp(helpPrinters, "server", serverCommand, context);

  const defaultCommand = cli
    .command("", "Start the little-thing TUI (default)")
    .action(() => {
      context.io.out("Welcome to Little Thing! TUI is under construction.");
    });
  registerCommandHelp(helpPrinters, "default", defaultCommand, context);

  const helpCommand = cli.command("help", "Show help").action(() => {
    cli.unsetMatchedCommand();
    cli.outputHelp();
  });
  registerCommandHelp(helpPrinters, "help", helpCommand, context);

  registerCommandHelp(
    helpPrinters,
    "config",
    registerConfigCommands(cli, context),
    context,
  );
  registerCommandHelp(
    helpPrinters,
    "system",
    registerSystemCommands(cli, context),
    context,
  );
  registerCommandHelp(
    helpPrinters,
    "providers",
    registerProviderCommands(cli, context),
    context,
  );
  registerCommandHelp(
    helpPrinters,
    "tools",
    registerToolCommands(cli, context),
    context,
  );
  registerCommandHelp(
    helpPrinters,
    "sessions",
    registerSessionCommands(cli, context),
    context,
  );
  const runCommand = registerRunCommand(cli, context);
  registerCommandHelp(helpPrinters, "run", runCommand, context);

  cli.help();
  cli.version("0.1.0");

  return { cli, context, helpPrinters };
}

function handleCliError(error: unknown, app: CliApp): number {
  if (isCacError(error)) {
    app.context.io.err(
      `CLI:INVALID_USAGE: ${normalizeCliUsageMessage(error.message)}`,
    );
    if (app.cli.matchedCommand) {
      printCommandHelp(app.cli.matchedCommand, app.context);
    }
    return 1;
  }

  if (error instanceof CommandUsageError) {
    app.context.io.err(`${error.code}: ${error.message}`);
    if (app.cli.matchedCommand) {
      printCommandHelp(app.cli.matchedCommand, app.context);
    } else {
      app.helpPrinters.get(error.commandKey)?.();
    }
    return 1;
  }

  const appError =
    error instanceof AppError ? error : new CliUnhandledError(error);
  app.context.io.err(`${appError.code}: ${appError.message}`);
  return 1;
}

export async function runCli(
  argv: string[] = process.argv,
  options: CliAppOptions = {},
): Promise<number> {
  const app = createCliApp(options);

  try {
    app.cli.parse(argv, { run: false });
    await app.cli.runMatchedCommand();
    return 0;
  } catch (error) {
    return handleCliError(error, app);
  }
}

#!/usr/bin/env bun
import { cac } from "cac";

const cli = cac("thing");

cli
  .command("server", "Start the little-thing server")
  .action(async () => {
    console.log("Starting little-thing server...");
    const { startServer } = await import("../server");
    startServer();
  });

cli
  .command("", "Start the little-thing TUI (default)")
  .action(() => {
    console.log("Welcome to Little Thing! TUI is under construction.");
  });

cli.help();
cli.version("0.1.0");
cli.parse();

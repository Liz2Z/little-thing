export interface CliIO {
  out(text?: string): void;
  err(text?: string): void;
  write(text: string): void;
  writeError(text: string): void;
}

export function createNodeIO(
  stdout: Pick<NodeJS.WriteStream, "write"> = process.stdout,
  stderr: Pick<NodeJS.WriteStream, "write"> = process.stderr,
): CliIO {
  return {
    out(text = "") {
      stdout.write(`${text}\n`);
    },
    err(text = "") {
      stderr.write(`${text}\n`);
    },
    write(text: string) {
      stdout.write(text);
    },
    writeError(text: string) {
      stderr.write(text);
    },
  };
}

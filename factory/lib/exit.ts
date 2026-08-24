export const EXIT_QUIET = 0;
export const EXIT_START = 10;
export const EXIT_STUCK = 20;

export class FactoryExit extends Error {
  readonly code: number;
  readonly stdout: string;

  constructor(code: number, stderr = "", stdout = "") {
    super(stderr);
    this.name = "FactoryExit";
    this.code = code;
    this.stdout = stdout;
  }
}

export function quiet(): never {
  throw new FactoryExit(EXIT_QUIET);
}

export function start(line: string): never {
  const stdout = line.endsWith("\n") ? line : `${line}\n`;
  throw new FactoryExit(EXIT_START, "", stdout);
}

export function stuck(reason: string): never {
  throw new FactoryExit(EXIT_STUCK, reason);
}

function writeLine(stream: NodeJS.WriteStream, text: string): void {
  if (!text) return;
  stream.write(text.endsWith("\n") ? text : `${text}\n`);
}

export async function runCli(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    process.exit(EXIT_QUIET);
  } catch (err) {
    if (err instanceof FactoryExit) {
      if (err.stdout) process.stdout.write(err.stdout);
      writeLine(process.stderr, err.message);
      process.exit(err.code);
    }
    const msg = err instanceof Error ? err.message : "unexpected error";
    writeLine(process.stderr, msg || "unexpected error");
    process.exit(EXIT_STUCK);
  }
}

import { accessSync, constants as fsConstants } from "node:fs";

export type CmdResult = {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export function commandTimeoutMs(): number {
  const raw = process.env.FACTORY_CMD_TIMEOUT_MS;
  if (raw && /^[0-9]+$/.test(raw)) return Number(raw);
  return DEFAULT_TIMEOUT_MS;
}

function envRecord(
  extra?: Record<string, string | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) out[k] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) delete out[k];
      else out[k] = v;
    }
  }
  return out;
}

export async function runCmd(
  argv: readonly string[],
  opts: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    timeoutMs?: number;
    stdin?: Uint8Array | "ignore";
  } = {},
): Promise<CmdResult> {
  if (argv.length === 0) {
    return { code: 1, stdout: "", stderr: "empty argv", timedOut: false };
  }
  const timeoutMs = opts.timeoutMs ?? commandTimeoutMs();
  const proc = Bun.spawn([...argv], {
    cwd: opts.cwd,
    env: envRecord(opts.env),
    stdin: opts.stdin ?? "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill("SIGKILL");
    } catch {
      // already exited
    }
  }, timeoutMs);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { code: code ?? 1, stdout, stderr, timedOut };
  } finally {
    clearTimeout(timer);
  }
}

export function which(name: string): string | null {
  return Bun.which(name);
}

/** PATH-only lookup. Unlike Bun.which, a stripped PATH cannot still find /usr/bin. */
export function whichOnPath(name: string, pathVar = process.env.PATH ?? ""): string | null {
  if (!name || name.includes("/") || name.includes("\0")) return null;
  for (const dir of pathVar.split(":")) {
    if (!dir) continue;
    const candidate = `${dir}/${name}`;
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

export function isExecutable(path: string): boolean {
  try {
    accessSync(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

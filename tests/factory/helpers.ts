import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const ROOT = join(import.meta.dir, "../..");
export const GATE = join(ROOT, "factory/gate.ts");
export const TICK = join(ROOT, "factory/tick.ts");
export const NOTIFY = join(ROOT, "factory/notify.ts");
export const FIX = join(ROOT, "tests/fixtures");
export const STUB_GH = join(ROOT, "tests/factory/stub-gh.ts");
export const STUB_HOST = join(ROOT, "tests/factory/stub-host.ts");
export const SKILL = join(ROOT, "skills/factory-builder/SKILL.md");
export const SHA = "0123456789abcdef0123456789abcdef01234567";
export const BUN = process.execPath;

export type ProcResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "factory-test-"));
}

export function cleanEnv(
  extra: Record<string, string | undefined> = {},
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return env;
}

export async function runBun(
  script: string,
  argv: string[],
  opts: {
    env?: Record<string, string | undefined>;
    stdin?: string;
    cwd?: string;
  } = {},
): Promise<ProcResult> {
  const env = cleanEnv(opts.env);
  const proc = Bun.spawn([BUN, script, ...argv], {
    cwd: opts.cwd,
    env,
    stdin: opts.stdin !== undefined ? new TextEncoder().encode(opts.stdin) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code: code ?? 1, stdout, stderr };
}

export async function runCmd(
  argv: string[],
  opts: { env?: Record<string, string | undefined>; cwd?: string } = {},
): Promise<ProcResult> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  if (opts.env) {
    for (const [k, v] of Object.entries(opts.env)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }
  const proc = Bun.spawn(argv, {
    cwd: opts.cwd,
    env,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code: code ?? 1, stdout, stderr };
}

export function trimNL(s: string): string {
  return s.replace(/\n$/, "");
}

export function makeBin(dir: string): { bin: string; path: string } {
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const path = `${bin}:${process.env.PATH ?? "/usr/bin:/bin"}`;
  return { bin, path };
}

export function linkStub(binDir: string, name: string, target: string): void {
  const dest = join(binDir, name);
  try {
    rmSync(dest, { force: true });
  } catch {
    // ignore
  }
  writeFileSync(
    dest,
    `#!/bin/sh\nexec "${BUN}" "${target}" "$@"\n`,
    { mode: 0o755 },
  );
}

export async function git(args: string[], cwd?: string): Promise<ProcResult> {
  return runCmd(["git", ...args], { cwd });
}

export async function makeProduct(
  dir: string,
  backend = "none",
  routing = true,
): Promise<string> {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, ".flow"), { recursive: true });
  await git(["init", "-q", dir]);
  await git(["-C", dir, "checkout", "-q", "-b", "main"]);
  await git([
    "-C",
    dir,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "--allow-empty",
    "-qm",
    "init",
  ]);
  writeFileSync(
    join(dir, ".flow/config.json"),
    JSON.stringify({ review: { backend } }),
  );
  if (routing) {
    writeFileSync(
      join(dir, "CLAUDE.md"),
      `<!-- flow-next:model-routing:start -->
<!-- reviewer: example -->
<!-- flow-next:model-routing:end -->
`,
    );
  }
  await git(["-C", dir, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git([
    "-C",
    dir,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-qm",
    "pin",
  ]);
  const sha = await git(["-C", dir, "rev-parse", "HEAD"]);
  return trimNL(sha.stdout);
}

export function factorySources(): string[] {
  const glob = new Bun.Glob("factory/**/*.{ts,sh}");
  return [...glob.scanSync({ cwd: ROOT })].map((p) => join(ROOT, p));
}

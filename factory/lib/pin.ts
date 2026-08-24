import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { isExecutable, runCmd, which, whichOnPath } from "./cmd.ts";

export const HOST_INVENTORY = [
  "claude",
  "grok",
  "cursor-agent",
  "droid",
  "opencode",
  "codex",
] as const;

const BACKENDS = new Set(["rp", "codex", "copilot", "cursor", "host", "none"]);
const PIN_TOKEN_RE = /^(rp|codex|copilot|cursor|host|none)(:.*)?$/;
const ROUTING_ASSIGN_RE =
  /(?:review\.backend|backend|reviewer)\s*[:=]\s*(\S+)/gi;
const ROUTING_START = "flow-next:model-routing:start";
const ROUTING_END = "flow-next:model-routing:end";

export type HostDrive = "loop" | "goal";

export type RoutingBlock = {
  file: string;
  block: string;
};

function hostBasename(bin: string): string {
  return basename(bin);
}

function inInventory(base: string): boolean {
  return (HOST_INVENTORY as readonly string[]).includes(base);
}

function lookupHost(spec: string): string | null {
  if (!spec) return null;
  if (spec.includes("/") || existsSync(spec)) {
    return isExecutable(spec) ? spec : null;
  }
  return which(spec);
}

function driveFromHelp(help: string): HostDrive | null {
  if (help.includes("/loop")) return "loop";
  if (help.includes("/goal")) return "goal";
  return null;
}

export async function hostProbe(
  bin: string,
): Promise<{ drive: HostDrive } | { error: string }> {
  if (!bin || !isExecutable(bin)) return { error: "missing host CLI" };
  const base = hostBasename(bin);
  if (!inInventory(base)) return { error: "host cannot run /loop or /goal" };
  // Grok Build (basename `grok`) has /loop and /goal as slash commands, same
  // idea as Claude Code, but `grok --help` does not print those strings.
  // Inventory + grok basename is enough; drive is loop.
  if (base === "grok") return { drive: "loop" };
  const help = await runCmd([bin, "--help"]);
  const drive = driveFromHelp(`${help.stdout}\n${help.stderr}`);
  if (!drive) return { error: "host cannot run /loop or /goal" };
  return { drive };
}

export async function hostResolve(): Promise<
  { bin: string; drive: HostDrive } | { error: string }
> {
  const spec = process.env.FACTORY_HOST ?? "";
  if (spec) {
    const bin = lookupHost(spec);
    if (!bin) return { error: "missing host CLI" };
    const probed = await hostProbe(bin);
    if ("error" in probed) return { error: probed.error };
    return { bin, drive: probed.drive };
  }
  for (const name of HOST_INVENTORY) {
    const bin = which(name);
    if (!bin) continue;
    const probed = await hostProbe(bin);
    if ("drive" in probed) return { bin, drive: probed.drive };
  }
  return { error: "missing host CLI" };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function reviewPinRead(
  checkout: string,
): { pin: string } | { error: string } {
  const cfg = `${checkout}/.flow/config.json`;
  if (!existsSync(cfg)) return { pin: "" };
  let text: string;
  try {
    text = readFileSync(cfg, "utf8");
  } catch {
    return { error: "review pin: malformed .flow/config.json" };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "review pin: malformed .flow/config.json" };
  }
  if (!isObject(data)) return { error: "review pin: malformed .flow/config.json" };
  if (!("review" in data)) return { pin: "" };
  if (!isObject(data.review)) {
    return { error: "unfulfillable review pin: malformed review object" };
  }
  if (!("backend" in data.review)) return { pin: "" };
  if (typeof data.review.backend !== "string" || data.review.backend === "") {
    return { error: "unfulfillable review pin: malformed backend" };
  }
  return { pin: data.review.backend };
}

export function reviewPinValidate(
  spec: string,
  hostBin: string,
): { ok: true } | { error: string } {
  if (!spec) return { ok: true };
  const parts = spec.split(":");
  // Grammar is backend[:model[:effort]]. Every split component must be non-empty
  // before PATH/binary probes so `codex:` / `copilot::` fail closed even if the CLI exists.
  if (parts.some((part) => part.length === 0)) {
    return { error: "unfulfillable review pin: empty pin segment" };
  }
  const backend = parts[0];
  if (!BACKENDS.has(backend)) {
    return { error: "unfulfillable review pin: unknown backend" };
  }
  const rest = parts.slice(1).join(":");
  if (backend === "rp" || backend === "host" || backend === "none") {
    if (rest) return { error: `unfulfillable review pin: ${backend} is bare-only` };
  }
  if (backend === "cursor") {
    if (!rest) return { error: "unfulfillable review pin: cursor requires cursor:<model>" };
    if (rest.includes(":")) {
      return { error: "unfulfillable review pin: cursor does not take effort" };
    }
  }
  if (backend === "codex" || backend === "copilot") {
    if (parts.length > 3) {
      return { error: "unfulfillable review pin: too many spec parts" };
    }
  }
  if (backend === "host" && hostBasename(hostBin) === "grok") {
    return { error: "unfulfillable review pin: host review fails closed for a Grok writer" };
  }
  if (backend === "cursor" && !which("cursor-agent")) {
    return { error: "unfulfillable review pin: cursor-agent missing" };
  }
  if (backend === "copilot" && !which("copilot")) {
    return { error: "unfulfillable review pin: copilot CLI missing" };
  }
  if (backend === "codex" && !which("codex")) {
    return { error: "unfulfillable review pin: codex CLI missing" };
  }
  return { ok: true };
}

function routingFiles(checkout: string): string[] {
  return [`${checkout}/CLAUDE.md`, `${checkout}/AGENTS.md`];
}

export function routingBlockRead(
  checkout: string,
): { blocks: RoutingBlock[] } | { error: string } {
  const blocks: RoutingBlock[] = [];
  for (const file of routingFiles(checkout)) {
    if (!existsSync(file)) continue;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      return { error: "unfulfillable review pin: cannot read routing file" };
    }
    if (!text.includes("flow-next:model-routing")) continue;
    const startCount = text.split(ROUTING_START).length - 1;
    const endCount = text.split(ROUTING_END).length - 1;
    const startIdx = text.indexOf(ROUTING_START);
    const endIdx = text.indexOf(ROUTING_END);
    if (startCount !== 1 || endCount !== 1 || startIdx < 0 || endIdx < startIdx) {
      return { error: "unfulfillable review pin: malformed routing block" };
    }
    const startLine = text.lastIndexOf("\n", startIdx) + 1;
    let endLine = text.indexOf("\n", endIdx);
    if (endLine < 0) endLine = text.length;
    const block = text.slice(startLine, endLine);
    blocks.push({ file, block });
  }
  return { blocks };
}

export function routingBlockValidate(
  block: string,
  hostBin: string,
): { ok: true } | { error: string } {
  ROUTING_ASSIGN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let found = false;
  while ((m = ROUTING_ASSIGN_RE.exec(block))) {
    const value = m[1].replace(/[.,;]+$/, "");
    if (!PIN_TOKEN_RE.test(value)) {
      return { error: "unfulfillable review pin: invalid routing assignment" };
    }
    const checked = reviewPinValidate(value, hostBin);
    if ("error" in checked) return checked;
    found = true;
  }
  if (!found) {
    return { error: "unfulfillable review pin: routing block has no assignment" };
  }
  return { ok: true };
}

function shQuote(value: string): string {
  return "'" + value.replaceAll("'", "'\\''") + "'";
}

/** Tick home is dirname(tree); grok's script(1) typescript lives there. */
export function hostTypescriptPath(tree: string): string {
  return join(dirname(tree), "host.typescript");
}

/**
 * Grok writes the session transcript under
 * ~/.grok/sessions/<encodeURIComponent(realpath(tree))>/<session-id>/.
 * Watch only that tree-encoded directory — never all of ~/.grok.
 */
export function grokSessionsDir(tree: string): string {
  const home = process.env.HOME && process.env.HOME.length > 0 ? process.env.HOME : homedir();
  let real = tree;
  try {
    real = realpathSync(tree);
  } catch {
    // tree may not exist yet; encode the path we were given
  }
  return join(home, ".grok", "sessions", encodeURIComponent(real));
}

const SESSION_LOG_NAMES = new Set(["chat_history.jsonl", "updates.jsonl"]);

function listSessionLogs(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 8) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.isFile() && SESSION_LOG_NAMES.has(e.name)) out.push(p);
    }
  };
  walk(root, 0);
  return out;
}

function extractSessionVerdict(root: string): string | undefined {
  for (const file of listSessionLogs(root)) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const found = extractVerdictLine(text);
    if (found) return found;
  }
  return undefined;
}

function extractVerdictLine(text: string): string | undefined {
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const trimmed = raw.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim();
    const idx = trimmed.search(/(?:PILOT|LAND)_VERDICT=/);
    if (idx >= 0) return trimmed.slice(idx);
  }
  return undefined;
}

function hostEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) out[k] = v;
  }
  out.FACTORY_CLAIM_POLICY = "skip-foreign";
  return out;
}

function readChildPids(pid: number): number[] {
  const out: number[] = [];
  let tasks: string[] = [];
  try {
    tasks = readdirSync(`/proc/${pid}/task`);
  } catch {
    return out;
  }
  for (const t of tasks) {
    try {
      const text = readFileSync(`/proc/${pid}/task/${t}/children`, "utf8");
      for (const p of text.trim().split(/\s+/)) {
        const n = Number(p);
        if (Number.isInteger(n) && n > 1) out.push(n);
      }
    } catch {
      // process already gone
    }
  }
  return out;
}

function readPgid(pid: number): number | undefined {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return undefined;
    const rest = stat.slice(close + 2).split(" ");
    const pgid = Number(rest[2]);
    return Number.isInteger(pgid) && pgid > 1 ? pgid : undefined;
  } catch {
    return undefined;
  }
}

function signalProcessTree(root: number, signal: "SIGTERM" | "SIGKILL"): void {
  const pids = new Set<number>();
  const stack = [root];
  while (stack.length) {
    const pid = stack.pop()!;
    if (pids.has(pid)) continue;
    pids.add(pid);
    for (const c of readChildPids(pid)) stack.push(c);
  }
  const mine = readPgid(process.pid) ?? process.pid;
  const pgids = new Set<number>();
  for (const pid of pids) {
    const g = readPgid(pid);
    if (g !== undefined && g !== mine) pgids.add(g);
  }
  for (const g of pgids) {
    try {
      process.kill(-g, signal);
    } catch {
      // already gone
    }
  }
  for (const pid of pids) {
    if (pid === process.pid) continue;
    try {
      process.kill(pid, signal);
    } catch {
      // already gone
    }
  }
}

async function pumpStream(
  stream: ReadableStream<Uint8Array>,
  chunks: string[],
  onChunk: () => void,
): Promise<void> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(dec.decode(value, { stream: true }));
    onChunk();
  }
}

async function runGrokHost(
  argv: readonly string[],
  opts: { cwd: string; typescript: string; sessionsDir: string; timeoutMs: number },
): Promise<{ code: number; stdout: string; stderr: string }> {
  writeFileSync(opts.typescript, "");
  const proc = Bun.spawn([...argv], {
    cwd: opts.cwd,
    env: hostEnv(),
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    // Own process group so we can SIGTERM/SIGKILL script+grok without this process.
    detached: true,
  });
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let verdict: string | undefined;
  let stoppedForVerdict = false;
  let grace: ReturnType<typeof setTimeout> | undefined;

  const killTree = (signal: "SIGTERM" | "SIGKILL") => {
    if (proc.pid !== undefined) signalProcessTree(proc.pid, signal);
    try {
      proc.kill(signal);
    } catch {
      // already exited
    }
  };

  const stillRunning = (): boolean => proc.exitCode == null;

  const consider = () => {
    if (verdict) return;
    let tsText = "";
    try {
      tsText = readFileSync(opts.typescript, "utf8");
    } catch {
      tsText = "";
    }
    const found =
      extractVerdictLine(stdoutChunks.join("")) ??
      extractVerdictLine(tsText) ??
      extractSessionVerdict(opts.sessionsDir);
    if (!found) return;
    verdict = found;
    // A host that prints a verdict and exits (including nonzero) must keep that
    // exit code. Only SIGTERM if it is still running — the live grok hang.
    if (!stillRunning()) return;
    grace = setTimeout(() => {
      if (!stillRunning()) return;
      stoppedForVerdict = true;
      killTree("SIGTERM");
    }, 250);
  };

  const timer = setTimeout(() => {
    killTree("SIGKILL");
  }, opts.timeoutMs);
  const poll = setInterval(consider, 50);

  try {
    await Promise.all([
      pumpStream(proc.stdout, stdoutChunks, consider),
      pumpStream(proc.stderr, stderrChunks, () => {}),
      proc.exited,
    ]);
  } finally {
    clearTimeout(timer);
    clearInterval(poll);
    if (grace) clearTimeout(grace);
  }
  consider();

  const stdout = stdoutChunks.join("");
  const stderr = stderrChunks.join("");
  let tsText = "";
  try {
    tsText = readFileSync(opts.typescript, "utf8");
  } catch {
    tsText = "";
  }

  if (stoppedForVerdict && verdict) {
    return { code: 0, stdout: `${verdict}\n`, stderr };
  }
  const captured = stdout.length > 0 ? stdout : tsText;
  return { code: proc.exitCode ?? 1, stdout: captured, stderr };
}

export function hostArgv(
  host: string,
  drive: HostDrive,
  skill: string,
  typescript?: string,
): string[] | { error: string } {
  // Grok Build slash commands are one prompt string. Claude-shaped hosts take
  // split argv (`/loop` `10m` <skill> or `/goal` <skill>).
  if (hostBasename(host) === "grok") {
    // grok 1.0.5 opens /dev/tty and exits ENXIO without a PTY. script(1) gives
    // one. --always-approve so a factory tick cannot block on a permission
    // prompt. Missing script(1) is stuck — never drop to no-TTY grok.
    // -f flushes the typescript so a hanging grok still surfaces PILOT/LAND_VERDICT.
    const scriptBin = whichOnPath("script");
    if (!scriptBin) return { error: "script(1) missing; grok needs a PTY" };
    if (!typescript) return { error: "missing host typescript path" };
    const prompt = drive === "loop" ? `/loop 10m ${skill}` : `/goal ${skill}`;
    const cmd = `${shQuote(host)} --always-approve --no-alt-screen ${shQuote(prompt)}`;
    return [scriptBin, "-q", "-e", "-f", "-c", cmd, typescript];
  }
  return drive === "loop" ? [host, "/loop", "10m", skill] : [host, "/goal", skill];
}

export async function hostRun(
  host: string,
  drive: HostDrive,
  kind: "pilot" | "land",
  tree: string,
): Promise<{ code: number; stdout: string; stderr: string } | { error: string }> {
  const skill = kind === "land" ? "/flow-next:land" : "/flow-next:pilot";
  const typescript = hostBasename(host) === "grok" ? hostTypescriptPath(tree) : undefined;
  const argv = hostArgv(host, drive, skill, typescript);
  if (!Array.isArray(argv)) return argv;
  const timeoutMs = Number(process.env.FACTORY_HOST_TIMEOUT_MS ?? 3_600_000);
  // Host ticks can run for a long time; do not apply the gh/git command deadline.
  if (typescript) {
    return runGrokHost(argv, {
      cwd: tree,
      typescript,
      sessionsDir: grokSessionsDir(tree),
      timeoutMs,
    });
  }
  return runCmd(argv, {
    cwd: tree,
    env: { FACTORY_CLAIM_POLICY: "skip-foreign" },
    timeoutMs,
  });
}

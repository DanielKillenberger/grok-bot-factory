import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { isExecutable, runCmd, which } from "./cmd.ts";

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

export async function hostRun(
  host: string,
  drive: HostDrive,
  kind: "pilot" | "land",
  tree: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const skill = kind === "land" ? "/flow-next:land" : "/flow-next:pilot";
  const argv =
    drive === "loop" ? [host, "/loop", "10m", skill] : [host, "/goal", skill];
  // Host ticks can run for a long time; do not apply the gh/git command deadline.
  return runCmd(argv, {
    cwd: tree,
    env: { FACTORY_CLAIM_POLICY: "skip-foreign" },
    timeoutMs: Number(process.env.FACTORY_HOST_TIMEOUT_MS ?? 3_600_000),
  });
}

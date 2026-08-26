#!/usr/bin/env bun
import { parseArgs } from "./lib/args.ts";
import { FactoryExit, EXIT_STUCK, runCli, stuck } from "./lib/exit.ts";
import { gh } from "./lib/gh.ts";
import { isRepoFullName } from "./lib/membership.ts";

const ALLOWED = new Set([
  "confirmed",
  "candidates",
  "builder-exists",
  "create-routine",
  "routine-url",
  "sender-key",
  "host",
]);

export const ROUTINE_FIRST_ACTION = "bun factory/gate.ts";
export const ROUTINE_COORDINATOR = "bun factory/tick.ts";

export type HookFailure = { repo: string; reason: string };

export type HooksReport = {
  builder: "assign-existing" | "create-if-none";
  routine: "reuse" | "create";
  routine_first_action: typeof ROUTINE_FIRST_ACTION;
  coordinator: typeof ROUTINE_COORDINATOR;
  model_first: false;
  host: string;
  pin: "keep";
  succeeded: string[];
  failed: HookFailure[];
};

type HookRow = { id: number; url: string };

function splitNames(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[,\s]+/).filter((s) => s.length > 0);
}

function uniqueNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function looksUnconfirmed(raw: string): boolean {
  const t = raw.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return false;
  try {
    const data = JSON.parse(t) as unknown;
    if (Array.isArray(data)) return true;
    if (typeof data === "object" && data !== null && "candidates" in data) return true;
  } catch {
    return true;
  }
  return true;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && Array.isArray(v) === false;
}

function desiredBody(url: string, secret: string, kind: "post" | "patch"): string {
  const config = {
    url,
    content_type: "json",
    secret,
    insecure_ssl: "0",
  };
  if (kind === "post") {
    return JSON.stringify({
      name: "web",
      events: ["push"],
      active: true,
      config,
    });
  }
  return JSON.stringify({
    active: true,
    events: ["push"],
    config,
  });
}

function parseHooks(stdout: string): HookRow[] | undefined {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(data)) return undefined;
  const items: unknown[] = data.every((x) => Array.isArray(x)) ? data.flat() : data;
  const rows: HookRow[] = [];
  for (const item of items) {
    if (!isRecord(item)) return undefined;
    if (typeof item.id !== "number" || !Number.isInteger(item.id)) return undefined;
    let url = "";
    if (isRecord(item.config) && typeof item.config.url === "string") {
      url = item.config.url;
    }
    rows.push({ id: item.id, url });
  }
  return rows;
}

async function listHooks(fullName: string): Promise<HookRow[] | { reason: string }> {
  const [owner, repo] = fullName.split("/");
  const res = await gh([
    "api",
    "--paginate",
    "--slurp",
    "--method",
    "GET",
    `repos/${owner}/${repo}/hooks?per_page=30`,
  ]);
  if (!res.ok) {
    return { reason: `gh ${res.class} listing hooks on ${fullName}` };
  }
  const parsed = parseHooks(res.stdout);
  if (parsed === undefined) {
    return { reason: `malformed hook list on ${fullName}` };
  }
  return parsed;
}

async function postHook(
  fullName: string,
  url: string,
  secret: string,
): Promise<{ ok: true } | { class: string; reason: string }> {
  const [owner, repo] = fullName.split("/");
  const res = await gh(
    ["api", "--method", "POST", `repos/${owner}/${repo}/hooks`, "--input", "-"],
    { stdin: desiredBody(url, secret, "post") },
  );
  if (res.ok) return { ok: true };
  return { class: res.class, reason: `gh ${res.class} creating hook on ${fullName}` };
}

async function patchHook(
  fullName: string,
  id: number,
  url: string,
  secret: string,
): Promise<{ ok: true } | { reason: string }> {
  const [owner, repo] = fullName.split("/");
  const res = await gh(
    ["api", "--method", "PATCH", `repos/${owner}/${repo}/hooks/${id}`, "--input", "-"],
    { stdin: desiredBody(url, secret, "patch") },
  );
  if (res.ok) return { ok: true };
  return { reason: `gh ${res.class} updating hook on ${fullName}` };
}

function matches(rows: HookRow[], url: string): HookRow[] {
  return rows.filter((h) => h.url === url);
}

async function convergeListed(
  fullName: string,
  url: string,
  secret: string,
  rows: HookRow[],
): Promise<{ ok: true } | { reason: string }> {
  const found = matches(rows, url);
  if (found.length >= 2) {
    return { reason: "ambiguous hooks" };
  }
  if (found.length === 1) {
    // GitHub GET redacts secret as ********; URL match is not identity.
    return patchHook(fullName, found[0].id, url, secret);
  }
  return { reason: `POST 422 then no matching hook on ${fullName}` };
}

async function convergeRepo(
  fullName: string,
  url: string,
  secret: string,
): Promise<{ ok: true } | { reason: string }> {
  const listed = await listHooks(fullName);
  if ("reason" in listed) return listed;
  const found = matches(listed, url);
  if (found.length >= 2) {
    return { reason: "ambiguous hooks" };
  }
  if (found.length === 1) {
    return patchHook(fullName, found[0].id, url, secret);
  }
  const posted = await postHook(fullName, url, secret);
  if ("ok" in posted) return posted;
  if (posted.class === "422") {
    const again = await listHooks(fullName);
    if ("reason" in again) return again;
    return convergeListed(fullName, url, secret, again);
  }
  return { reason: posted.reason };
}

function resolveBuilder(flags: Map<string, string>): HooksReport["builder"] {
  const exists = flags.get("builder-exists") ?? "1";
  return exists === "0" ? "create-if-none" : "assign-existing";
}

function resolveRoutine(flags: Map<string, string>): HooksReport["routine"] {
  const create = flags.has("create-routine");
  const panel = (process.env.FACTORY_PANEL_ROUTINE ?? "").trim();
  if (panel === "webhook" && create) {
    stuck("webhook routine exists; do not mint a second");
  }
  return create ? "create" : "reuse";
}

export async function runHooks(argv: string[]): Promise<HooksReport> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (rest.length > 0 || flags.has("candidates")) {
    stuck("unconfirmed input refused");
  }
  if (!flags.has("confirmed")) {
    stuck("--confirmed is required");
  }
  const rawConfirmed = flags.get("confirmed") ?? "";
  if (looksUnconfirmed(rawConfirmed)) {
    stuck("unconfirmed input refused");
  }

  const confirmed = uniqueNames(splitNames(rawConfirmed));
  for (const n of confirmed) {
    if (!isRepoFullName(n)) stuck(`hooks: invalid repo name ${n}`);
  }

  const url = (flags.get("routine-url") ?? process.env.FACTORY_ROUTINE_URL ?? "").trim();
  const secret = (flags.get("sender-key") ?? process.env.FACTORY_SENDER_KEY ?? "").trim();
  if (!url || !secret) stuck("routine URL and sender key are required");
  if (url.includes("\n") || url.includes("\r") || secret.includes("\n") || secret.includes("\r")) {
    stuck("routine URL and sender key are required");
  }

  const hostCli = (flags.get("host") ?? process.env.FACTORY_HOST ?? "").trim();
  const report: HooksReport = {
    builder: resolveBuilder(flags),
    routine: resolveRoutine(flags),
    routine_first_action: ROUTINE_FIRST_ACTION,
    coordinator: ROUTINE_COORDINATOR,
    model_first: false,
    host: hostCli,
    pin: "keep",
    succeeded: [],
    failed: [],
  };

  for (const repo of confirmed) {
    const result = await convergeRepo(repo, url, secret);
    if ("ok" in result) report.succeeded.push(repo);
    else report.failed.push({ repo, reason: result.reason });
  }
  return report;
}

if (import.meta.main) {
  await runCli(async () => {
    const report = await runHooks(process.argv.slice(2));
    const json = `${JSON.stringify(report)}\n`;
    process.stdout.write(json);
    if (report.failed.length > 0) {
      throw new FactoryExit(EXIT_STUCK, `hooks: ${report.failed.length} repo(s) failed`);
    }
  });
}

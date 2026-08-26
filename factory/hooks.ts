#!/usr/bin/env bun
import { parseArgs } from "./lib/args.ts";
import { runCli, stuck } from "./lib/exit.ts";
import { gh } from "./lib/gh.ts";
import { isRepoFullName } from "./lib/membership.ts";

const ALLOWED = new Set(["confirmed", "host", "candidates"]);
const PAGE = 30;
const PAGE_CAP = 10_000;

export type RoutineWiring = {
  type: "webhook";
  first_action: "exec";
  command: "bun factory/gate.ts";
  model: false;
  then: "coordinator/tick";
  host_cli: string;
  pin: "preserve";
};

export type HookFailure = { repo: string; reason: string };

export type HooksReport = {
  builder: "assign-existing-or-create-if-none";
  routine: RoutineWiring;
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

export function routineWiring(hostCli: string): RoutineWiring {
  return {
    type: "webhook",
    first_action: "exec",
    command: "bun factory/gate.ts",
    model: false,
    then: "coordinator/tick",
    host_cli: hostCli || "instance",
    pin: "preserve",
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
  const rows: HookRow[] = [];
  for (const item of data) {
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
  const all: HookRow[] = [];
  for (let page = 1, limit = PAGE; limit <= PAGE_CAP; page += 1, limit += PAGE) {
    const res = await gh([
      "api",
      "--method",
      "GET",
      `repos/${owner}/${repo}/hooks?per_page=${PAGE}&page=${page}`,
    ]);
    if (!res.ok) {
      return { reason: `gh ${res.class} listing hooks on ${fullName}` };
    }
    const parsed = parseHooks(res.stdout);
    if (parsed === undefined) {
      return { reason: `malformed hook list on ${fullName}` };
    }
    all.push(...parsed);
    if (parsed.length < PAGE) return all;
  }
  return all;
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
    [
      "api",
      "--method",
      "PATCH",
      `repos/${owner}/${repo}/hooks/${id}`,
      "--input",
      "-",
    ],
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
    return { reason: `duplicate webhook URL on ${fullName}` };
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
    return { reason: `duplicate webhook URL on ${fullName}` };
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

export async function runHooks(argv: string[]): Promise<HooksReport> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (rest.length > 0 || flags.has("candidates") || !flags.has("confirmed")) {
    stuck("unconfirmed input refused");
  }

  const confirmed = uniqueNames(splitNames(flags.get("confirmed")));
  if (confirmed.length === 0) stuck("unconfirmed input refused");
  for (const n of confirmed) {
    if (!isRepoFullName(n)) stuck(`hooks: invalid repo name ${n}`);
  }

  const url = (process.env.FACTORY_ROUTINE_URL ?? "").trim();
  const secret = (process.env.FACTORY_SENDER_KEY ?? "").trim();
  if (!url || !secret) stuck("hooks: missing routine URL or sender key");
  if (url.includes("\n") || url.includes("\r") || secret.includes("\n") || secret.includes("\r")) {
    stuck("hooks: missing routine URL or sender key");
  }

  const hostCli = (flags.get("host") ?? process.env.FACTORY_HOST ?? "").trim();
  const report: HooksReport = {
    builder: "assign-existing-or-create-if-none",
    routine: routineWiring(hostCli),
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
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (report.failed.length > 0) {
      stuck(`hooks: ${report.failed.length} repo(s) failed`);
    }
  });
}

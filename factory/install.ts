#!/usr/bin/env bun
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { EXIT_STUCK, FactoryExit, runCli, stuck } from "./lib/exit.ts";
import { gh } from "./lib/gh.ts";
import { isRepoFullName } from "./lib/github_push.ts";

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
export const ROUTINE_COORDINATOR = "skills/factory-coordinator/SKILL.md";
const WORKFLOW_PATH = ".github/workflows/factory-forward.yml";
const SECRET_URL = "GROK_BOT_WEBHOOK_URL";
const SECRET_KEY = "GROK_BOT_SENDER_KEY";

export type InstallFailure = { repo: string; reason: string };

export type InstallReport = {
  builder: "assign-existing" | "create-if-none";
  routine: "reuse" | "create";
  routine_first_action: typeof ROUTINE_FIRST_ACTION;
  coordinator: typeof ROUTINE_COORDINATOR;
  model_first: false;
  host: string;
  pin: "keep";
  succeeded: string[];
  failed: InstallFailure[];
};

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
  if (t.startsWith("{") || t.startsWith("[")) return true;
  return false;
}

function secretValue(
  flags: Map<string, string>,
  flag: string,
  envNames: string[],
): string {
  const fromFlag = flags.get(flag);
  if (fromFlag !== undefined && fromFlag !== "") return fromFlag;
  for (const name of envNames) {
    const v = process.env[name];
    if (v) return v;
  }
  return "";
}

async function loadTemplate(): Promise<string> {
  const file = Bun.file(join(import.meta.dir, "..", WORKFLOW_PATH));
  if (!(await file.exists())) stuck("install: standing Action template missing");
  return file.text();
}

function b64(text: string): string {
  return Buffer.from(text).toString("base64");
}

function decodeContents(stdout: string): { sha: string; text: string } | undefined {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return undefined;
  const rec = data as Record<string, unknown>;
  if (typeof rec.sha !== "string" || typeof rec.content !== "string") return undefined;
  const text = Buffer.from(rec.content.replace(/\n/g, ""), "base64").toString("utf8");
  return { sha: rec.sha, text };
}

async function putWorkflowFields(
  owner: string,
  repo: string,
  content: string,
  sha?: string,
): Promise<{ ok: boolean; class: string; stderr: string }> {
  const argv = [
    "api",
    "--method",
    "PUT",
    `repos/${owner}/${repo}/contents/${WORKFLOW_PATH}`,
    "-f",
    `message=converge factory-forward Action`,
    "-f",
    `content=${b64(content)}`,
  ];
  if (sha) {
    argv.push("-f", `sha=${sha}`);
  }
  return gh(argv);
}

async function getWorkflow(
  owner: string,
  repo: string,
): Promise<{ kind: "missing" | "found" | "error"; sha?: string; text?: string; reason?: string }> {
  const res = await gh([
    "api",
    "--method",
    "GET",
    `repos/${owner}/${repo}/contents/${WORKFLOW_PATH}`,
  ]);
  if (!res.ok && res.class === "404") return { kind: "missing" };
  if (!res.ok) {
    return { kind: "error", reason: `contents GET ${res.class}` };
  }
  const decoded = decodeContents(res.stdout);
  if (!decoded) return { kind: "error", reason: "contents GET malformed" };
  return { kind: "found", sha: decoded.sha, text: decoded.text };
}

async function convergeWorkflow(
  fullName: string,
  template: string,
): Promise<string | undefined> {
  const [owner, repo] = fullName.split("/");
  let current = await getWorkflow(owner, repo);
  if (current.kind === "error") return current.reason;
  if (current.kind === "found" && current.text === template) return undefined;

  const putOnce = async (sha?: string) => putWorkflowFields(owner, repo, template, sha);

  let put = await putOnce(current.kind === "found" ? current.sha : undefined);
  if (!put.ok) {
    const retryable = /HTTP 409|HTTP 422/.test(put.stderr);
    if (retryable) {
      current = await getWorkflow(owner, repo);
      if (current.kind === "error") return current.reason;
      if (current.kind === "found" && current.text === template) return undefined;
      put = await putOnce(current.kind === "found" ? current.sha : undefined);
    }
  }
  if (!put.ok) return `contents PUT ${put.class}`;
  return undefined;
}

async function setSecrets(
  fullName: string,
  url: string,
  key: string,
): Promise<string | undefined> {
  const urlRes = await gh([
    "secret",
    "set",
    SECRET_URL,
    "--repo",
    fullName,
    "--body",
    url,
  ]);
  if (!urlRes.ok) return `secret set ${SECRET_URL} ${urlRes.class}`;
  const keyRes = await gh([
    "secret",
    "set",
    SECRET_KEY,
    "--repo",
    fullName,
    "--body",
    key,
  ]);
  if (!keyRes.ok) return `secret set ${SECRET_KEY} ${keyRes.class}`;
  return undefined;
}

export async function runInstall(argv: string[]): Promise<InstallReport> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (flags.has("candidates") || rest.length > 0) {
    stuck("unconfirmed input refused");
  }
  const confirmedRaw = flags.get("confirmed");
  if (confirmedRaw === undefined) stuck("--confirmed is required");
  if (looksUnconfirmed(confirmedRaw)) stuck("unconfirmed input refused");

  const names = uniqueNames(splitNames(confirmedRaw));
  if (names.length === 0) stuck("--confirmed is required");
  for (const n of names) {
    if (!isRepoFullName(n)) stuck(`install: invalid repo name ${n}`);
  }

  const url = secretValue(flags, "routine-url", [
    "GROK_BOT_WEBHOOK_URL",
    "FACTORY_ROUTINE_URL",
  ]);
  const key = secretValue(flags, "sender-key", [
    "GROK_BOT_SENDER_KEY",
    "FACTORY_SENDER_KEY",
  ]);
  if (!url || !key) stuck("routine URL and sender key are required");

  const builderExists = flags.get("builder-exists") ?? "1";
  const createRoutine = flags.get("create-routine") ?? "no";
  const host = flags.get("host") ?? process.env.FACTORY_HOST ?? "grok";

  const template = await loadTemplate();
  if (!template.includes("Authorization: Bearer") || !template.includes("factory-forward repo=")) {
    stuck("install: standing Action template missing identity contract");
  }

  const succeeded: string[] = [];
  const failed: InstallFailure[] = [];
  for (const fullName of names) {
    const wf = await convergeWorkflow(fullName, template);
    if (wf) {
      failed.push({ repo: fullName, reason: wf });
      continue;
    }
    const sec = await setSecrets(fullName, url, key);
    if (sec) {
      failed.push({ repo: fullName, reason: sec });
      continue;
    }
    succeeded.push(fullName);
  }

  const report: InstallReport = {
    builder: builderExists === "0" ? "create-if-none" : "assign-existing",
    routine: createRoutine === "yes" ? "create" : "reuse",
    routine_first_action: ROUTINE_FIRST_ACTION,
    coordinator: ROUTINE_COORDINATOR,
    model_first: false,
    host,
    pin: "keep",
    succeeded,
    failed,
  };
  process.stdout.write(`${JSON.stringify(report)}\n`);
  if (failed.length > 0) {
    throw new FactoryExit(EXIT_STUCK, "install: partial failure");
  }
  return report;
}

if (import.meta.main) {
  await runCli(async () => {
    await runInstall(process.argv.slice(2));
  });
}

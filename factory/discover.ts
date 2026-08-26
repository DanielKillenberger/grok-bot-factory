#!/usr/bin/env bun
import { parseArgs } from "./lib/args.ts";
import { runCli, stuck } from "./lib/exit.ts";
import { gh } from "./lib/gh.ts";
import { probeFlowDir } from "./lib/membership.ts";

const ALLOWED = new Set(["whitelist", "owner", "named"]);
const PAGE = 100;
const PAGE_CAP = 10_000;

export type DiscoverResult = {
  candidates: string[];
  named_without_flow: string[];
};

function splitNames(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(/[,\s]+/).filter((s) => s.length > 0);
}

function parseRepoList(stdout: string): string[] | undefined {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(data)) return undefined;
  const names: string[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return undefined;
    }
    const n = (item as { nameWithOwner?: unknown }).nameWithOwner;
    if (typeof n !== "string" || !n.includes("/") || n.split("/").length !== 2) {
      return undefined;
    }
    names.push(n);
  }
  return names;
}

async function listRepos(owner: string | undefined): Promise<string[]> {
  let limit = PAGE;
  let names: string[] = [];
  while (limit <= PAGE_CAP) {
    const argv = ["repo", "list"];
    if (owner) argv.push(owner);
    argv.push("--limit", String(limit), "--json", "nameWithOwner");
    const res = await gh(argv);
    if (!res.ok) {
      stuck(`discover: gh ${res.class} listing repos`);
    }
    const parsed = parseRepoList(res.stdout);
    if (parsed === undefined) {
      stuck("discover: malformed repo list");
    }
    names = parsed;
    if (names.length < limit) return names;
    limit += PAGE;
  }
  return names;
}

export async function runDiscover(argv: string[]): Promise<DiscoverResult> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  const whitelistFlag = flags.get("whitelist");
  if (whitelistFlag !== undefined) {
    process.env.FACTORY_MEMBERSHIP_WHITELIST = whitelistFlag;
  }
  const whitelist = splitNames(process.env.FACTORY_MEMBERSHIP_WHITELIST);
  const named = new Set([...splitNames(flags.get("named")), ...rest]);
  const owner = flags.get("owner");

  const scan = new Set<string>();
  if (whitelist.length > 0) {
    for (const n of whitelist) scan.add(n);
  } else {
    for (const n of await listRepos(owner)) scan.add(n);
  }
  for (const n of named) scan.add(n);

  const candidates: string[] = [];
  const namedWithoutFlow: string[] = [];
  for (const fullName of [...scan].sort()) {
    const probe = await probeFlowDir(fullName);
    if (probe.result === "stuck") {
      stuck(probe.reason ?? `discover: cannot probe ${fullName}`);
    }
    if (probe.result === "member") {
      candidates.push(fullName);
      continue;
    }
    if (named.has(fullName)) {
      namedWithoutFlow.push(fullName);
    }
  }

  return { candidates, named_without_flow: namedWithoutFlow };
}

if (import.meta.main) {
  await runCli(async () => {
    const result = await runDiscover(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}

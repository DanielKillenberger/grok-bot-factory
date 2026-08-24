#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
import { parseArgs } from "./lib/args.ts";
import { quiet, runCli, stuck } from "./lib/exit.ts";

const ALLOWED = new Set(["event", "reason", "from-exit"]);

const OWNER_GATED = new Set(["DEFERRED_TO_LAND", "send", "pay", "publish", "merge"]);

function classifyFromExit(fromExit: string, reason: string): string | "quiet" {
  if (fromExit === "0" || fromExit === "10") return "quiet";
  if (fromExit === "20") {
    if (/host verdict ASKED(\s|$)/.test(reason)) return "ASKED";
    if (/host verdict DEFERRED_TO_LAND(\s|$)/.test(reason)) return "DEFERRED_TO_LAND";
    return "NEEDS_HUMAN";
  }
  return "quiet";
}

function normalizeEvent(event: string): string | "quiet" {
  switch (event) {
    case "NEEDS_HUMAN":
    case "ASKED":
    case "DEFERRED_TO_LAND":
    case "send":
    case "pay":
    case "publish":
    case "merge":
      return event;
    case "BLOCKED":
    case "blocked":
    case "dirty-tree":
    case "dirty_tree":
    case "dirty tree":
      return "NEEDS_HUMAN";
    case "":
      return "quiet";
    default: {
      const n = event.toLowerCase();
      switch (n) {
        case "needs_human":
        case "needs-human":
        case "needs human":
          return "NEEDS_HUMAN";
        case "asked":
          return "ASKED";
        case "deferred_to_land":
        case "deferred-to-land":
        case "deferred to land":
          return "DEFERRED_TO_LAND";
        case "send":
        case "pay":
        case "publish":
        case "merge":
          return n;
        case "blocked":
        case "dirty tree":
        case "dirty-tree":
        case "dirty_tree":
          return "NEEDS_HUMAN";
        case "no_work":
        case "no-work":
        case "no work":
        case "quiet":
        case "picked up":
        case "picked-up":
        case "still running":
        case "still-running":
        case "pr opened":
        case "pr-opened":
        case "progress":
          return "quiet";
        default:
          return "quiet";
      }
    }
  }
}

function kindOf(event: string): string | "quiet" {
  if (event === "NEEDS_HUMAN") return "NEEDS_HUMAN";
  if (event === "ASKED") return "ASKED";
  if (OWNER_GATED.has(event)) return "owner-gated";
  return "quiet";
}

export async function runNotify(argv: string[]): Promise<void> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (rest.length > 0) stuck("unexpected argument");

  let event = flags.get("event") ?? "";
  const reason = flags.get("reason") ?? "";
  const fromExit = flags.get("from-exit") ?? "";

  if (!event && fromExit) {
    const mapped = classifyFromExit(fromExit, reason);
    if (mapped === "quiet") quiet();
    event = mapped;
  }

  const normalized = normalizeEvent(event);
  if (normalized === "quiet") quiet();
  event = normalized;

  const kind = kindOf(event);
  if (kind === "quiet") quiet();

  const payload = JSON.stringify({
    event,
    kind,
    reason,
    path: "builder->main->human",
  });
  process.stdout.write(`${payload}\n`);

  const log = process.env.FACTORY_NOTIFY_LOG;
  if (log) {
    try {
      appendFileSync(log, `${payload}\n`);
    } catch {
      stuck("cannot write notify log");
    }
  }
}

if (import.meta.main) {
  await runCli(() => runNotify(process.argv.slice(2)));
}

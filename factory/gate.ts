#!/usr/bin/env bun
import { parseArgs } from "./lib/args.ts";
import { quiet, runCli, start, stuck } from "./lib/exit.ts";
import { readPayload } from "./lib/github_push.ts";
import { membershipCheck } from "./lib/membership.ts";
import { readySelect } from "./lib/ready.ts";

const ALLOWED = new Set(["whitelist"]);

export async function runGate(argv: string[]): Promise<void> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  const whitelist = flags.get("whitelist");
  if (whitelist !== undefined) {
    process.env.FACTORY_MEMBERSHIP_WHITELIST = whitelist;
  }

  const payloadArg = rest[0];
  const parsed = await readPayload(payloadArg);
  if (parsed.kind === "quiet") quiet();
  if (parsed.kind === "stuck") stuck(parsed.reason);

  const { full_name, after } = parsed.ident;
  const mem =
    parsed.kind === "check"
      ? await membershipCheck(full_name)
      : await membershipCheck(full_name, after);
  if (mem.result === "quiet") quiet();
  if (mem.result === "stuck") stuck(mem.reason ?? "cannot decide membership");

  if (parsed.kind === "check") {
    start(`${full_name} ${after} check ${parsed.specId}`);
  }

  const ready = await readySelect(full_name, after);
  if (ready.quiet) quiet();
  if (ready.stuck) stuck(ready.stuck);
  if (ready.kind === "pilot" || ready.kind === "land") {
    start(`${full_name} ${after} ${ready.kind}`);
  }
  stuck("cannot classify ready work");
}

if (import.meta.main) {
  await runCli(() => runGate(process.argv.slice(2)));
}

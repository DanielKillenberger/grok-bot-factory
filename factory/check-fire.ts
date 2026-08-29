#!/usr/bin/env bun
import { parseArgs } from "./lib/args.ts";
import { factoryWebhookSecrets, postFactoryCheckWebhook } from "./lib/coordinator.ts";
import { runCli, stuck } from "./lib/exit.ts";

const ALLOWED = new Set(["repo", "spec", "purpose", "sha"]);

export async function runCheckFire(argv: string[]): Promise<void> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (rest.length > 0) stuck("unexpected argument");
  const repo = flags.get("repo") ?? "";
  const specId = flags.get("spec") ?? "";
  if (!repo || !specId) stuck("repo and spec are required");
  const secrets = factoryWebhookSecrets();
  if ("error" in secrets) stuck("routine URL and sender key are required");
  const posted = await postFactoryCheckWebhook({
    ...secrets,
    repo,
    specId,
    purpose: flags.get("purpose") === "pr-watch" ? "pr-watch" : "build-run",
    sha: flags.get("sha"),
  });
  if ("error" in posted) stuck("check-fire webhook post failed");
}

if (import.meta.main) {
  await runCli(() => runCheckFire(process.argv.slice(2)));
}

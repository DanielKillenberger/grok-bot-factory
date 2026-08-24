#!/usr/bin/env bun
import { appendFileSync, existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "./lib/args.ts";
import { quiet, runCli, stuck } from "./lib/exit.ts";
import {
  hostProbe,
  hostResolve,
  hostRun,
  reviewPinRead,
  reviewPinValidate,
  routingBlockRead,
  routingBlockValidate,
} from "./lib/pin.ts";
import {
  allocHome,
  initWorktreeRoot,
  tickIdFromHome,
  worktreeAddAt,
  worktreeRemoveAt,
} from "./lib/worktree.ts";

const ALLOWED = new Set(["host", "worktree-root", "clone-url"]);
const REPO_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;

type Tick = {
  id: string;
  home: string;
  tree: string;
  treeReal: string;
  mirror: string;
  fullName: string;
  sha: string;
  kind: "pilot" | "land";
  log: string;
  root: string;
  cleaned: boolean;
};

function tickLog(tick: Tick, phase: string, extra: Record<string, string>): void {
  const rec: Record<string, string> = {
    phase,
    tick: tick.id,
    repo: tick.fullName,
    sha: tick.sha,
    kind: tick.kind,
    ...extra,
  };
  try {
    appendFileSync(tick.log, `${JSON.stringify(rec)}\n`);
  } catch {
    stuck("cannot write tick log");
  }
}

async function cleanup(tick: Tick): Promise<void> {
  if (tick.cleaned) return;
  tick.cleaned = true;
  if (tick.tree && existsSync(tick.tree)) {
    try {
      tickLog(tick, "cleanup", { tree: tick.tree });
    } catch {
      // never mask the original outcome
    }
    let isLink = false;
    try {
      isLink = lstatSync(tick.tree).isSymbolicLink();
    } catch {
      isLink = false;
    }
    if (isLink) {
      try {
        tickLog(tick, "cleanup", { stuck_reason: "dest is a symlink; not following" });
      } catch {
        // ignore
      }
    } else {
      const rm = await worktreeRemoveAt({
        dest: tick.tree,
        mirror: tick.mirror,
        fullName: tick.fullName,
        ours: tick.treeReal || tick.tree,
        root: tick.root,
        branch: `factory/${tick.id}`,
      });
      if (rm.error) {
        try {
          tickLog(tick, "cleanup", { stuck_reason: "dirty or locked tree; not force-removed" });
        } catch {
          // ignore
        }
      }
    }
  }
  if (tick.home && existsSync(tick.home)) {
    if (tick.tree && existsSync(tick.tree)) {
      return;
    }
    rmSync(tick.home, { recursive: true, force: true });
  }
}

async function parseStart(
  rest: string[],
): Promise<{ repo: string; sha: string; kind: "pilot" | "land" }> {
  if (rest.length >= 3) {
    return { repo: rest[0], sha: rest[1], kind: rest[2] as "pilot" | "land" };
  }
  if (rest.length === 0) {
    const parts = (await Bun.stdin.text()).trim().split(/\s+/);
    if (parts.length < 3) stuck("missing gate start output");
    return { repo: parts[0], sha: parts[1], kind: parts[2] as "pilot" | "land" };
  }
  stuck("missing gate start output");
}

function hostExitReason(code: number, stderr: string): string {
  const line = stderr
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ? `host exited ${code}: ${line}` : `host exited ${code}`;
}

export async function runTick(argv: string[]): Promise<void> {
  const { flags, rest } = parseArgs(argv, ALLOWED);
  if (flags.has("host")) process.env.FACTORY_HOST = flags.get("host");
  if (flags.has("worktree-root")) process.env.FACTORY_WORKTREE_ROOT = flags.get("worktree-root");
  if (flags.has("clone-url")) process.env.FACTORY_CLONE_URL = flags.get("clone-url");

  const start = await parseStart(rest);
  if (!REPO_RE.test(start.repo) || start.repo.includes("//")) stuck("invalid repo");
  if (!SHA_RE.test(start.sha)) stuck("invalid sha");
  if (start.kind !== "pilot" && start.kind !== "land") stuck("invalid kind");

  const root = initWorktreeRoot(process.env.FACTORY_WORKTREE_ROOT);
  if ("error" in root) stuck(root.error);

  const home = allocHome(root.real);
  if (typeof home !== "string") stuck(home.error);

  const tick: Tick = {
    id: tickIdFromHome(home),
    home,
    tree: join(home, "tree"),
    treeReal: "",
    mirror: "",
    fullName: start.repo,
    sha: start.sha,
    kind: start.kind,
    log: join(root.real, "logs", `${tickIdFromHome(home)}.jsonl`),
    root: root.real,
    cleaned: false,
  };
  mkdirSync(join(root.real, "logs"), { recursive: true });

  try {
    tickLog(tick, "alloc", { home: tick.home });

    const resolved = await hostResolve();
    if ("error" in resolved) {
      stuck(
        resolved.error === "missing host CLI"
          ? "missing host CLI or host cannot run /loop or /goal"
          : "missing host CLI or host cannot run /loop or /goal",
      );
    }
    const probed = await hostProbe(resolved.bin);
    if ("error" in probed) stuck("host cannot run /loop or /goal");
    tickLog(tick, "host-probe", { bin: resolved.bin, drive: probed.drive });

    const url = process.env.FACTORY_CLONE_URL || `https://github.com/${tick.fullName}.git`;
    const branch = `factory/${tick.id}`;
    const added = await worktreeAddAt({
      dest: tick.tree,
      url,
      sha: tick.sha,
      branch,
      fullName: tick.fullName,
      root: tick.root,
    });
    if ("error" in added) stuck("cannot create worktree");
    tick.mirror = added.mirror;
    try {
      if (lstatSync(tick.tree).isSymbolicLink()) stuck("symlink-escape: worktree");
    } catch {
      stuck("cannot create worktree");
    }
    tick.treeReal = realpathSync(tick.tree);
    tickLog(tick, "worktree", { path: tick.tree, mirror: tick.mirror });

    const pin = reviewPinRead(tick.tree);
    if ("error" in pin) stuck("unfulfillable review pin");
    const pinOk = reviewPinValidate(pin.pin, resolved.bin);
    if ("error" in pinOk) stuck("unfulfillable review pin");

    const routing = routingBlockRead(tick.tree);
    if ("error" in routing) stuck(routing.error);
    for (const rb of routing.blocks) {
      const routeOk = routingBlockValidate(rb.block, resolved.bin);
      if ("error" in routeOk) stuck("unfulfillable review pin");
    }
    tickLog(tick, "pin", { backend: pin.pin });

    const cfg = join(tick.tree, ".flow/config.json");
    const pinBefore = pin.pin;
    const cfgExisted = existsSync(cfg);
    const routingBefore = routing.blocks.map((b) => ({ file: b.file, block: b.block }));

    const ran = await hostRun(resolved.bin, probed.drive, tick.kind, tick.tree);
    if (ran.code !== 0) {
      try {
        tickLog(tick, "invoke", { rc: String(ran.code), verdict: "", drive: probed.drive });
      } catch {
        // ignore
      }
      stuck(hostExitReason(ran.code, ran.stderr));
    }

    const verdictRe = tick.kind === "land" ? /^LAND_VERDICT=/ : /^PILOT_VERDICT=/;
    const lines = ran.stdout.split(/\r?\n/).filter((l) => verdictRe.test(l));
    const last = lines.at(-1) ?? "";
    const raw = last.includes("=") ? last.slice(last.indexOf("=") + 1) : "";
    const verdict = raw.split(/\s/)[0] ?? "";
    tickLog(tick, "invoke", { rc: String(ran.code), verdict, drive: probed.drive });

    if (cfgExisted) {
      if (!existsSync(cfg)) stuck("review pin overwritten");
      const afterPin = reviewPinRead(tick.tree);
      if ("error" in afterPin) stuck("unfulfillable review pin");
      if (afterPin.pin !== pinBefore) stuck("review pin overwritten");
    }
    if (routingBefore.length > 0) {
      for (const before of routingBefore) {
        if (!existsSync(before.file)) stuck("routing block overwritten");
      }
      const afterRoute = routingBlockRead(tick.tree);
      if ("error" in afterRoute) stuck("routing block overwritten");
      if (afterRoute.blocks.length !== routingBefore.length) {
        stuck("routing block overwritten");
      }
      for (let i = 0; i < routingBefore.length; i++) {
        const after = afterRoute.blocks[i];
        if (
          after.file !== routingBefore[i].file ||
          after.block !== routingBefore[i].block
        ) {
          stuck("routing block overwritten");
        }
      }
    }

    if (verdict === "NO_WORK") {
      tickLog(tick, "verdict", { host_verdict: verdict });
      quiet();
    }
    if (
      verdict === "DEFERRED_TO_LAND" ||
      verdict === "NEEDS_HUMAN" ||
      verdict === "ASKED" ||
      verdict === "BLOCKED"
    ) {
      stuck(`host verdict ${verdict}`);
    }
    stuck("host produced no verdict");
  } finally {
    try {
      await cleanup(tick);
    } catch {
      // never mask the original outcome
    }
  }
}

if (import.meta.main) {
  await runCli(() => runTick(process.argv.slice(2)));
}

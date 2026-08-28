import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isRepoFullName } from "./github_push.ts";
import { withFileLock } from "./lock.ts";

export const FACTORY_CAP = 10;
export const SHIPPED_HOW_TO_RUN_TEMPLATE = join(
  import.meta.dir,
  "../../skills/factory-coordinator/assets/how-to-run.template.md",
);

export type NamedJob =
  | "stop"
  | "plan"
  | "plan-review"
  | "work-rolling"
  | "spec-completion-review"
  | "watch-or-fix"
  | "make-pr";

export type ClassifyFields = {
  specStatus: "open" | "merged" | "closed";
  hasPlan: boolean;
  planReviewStatus: string | null;
  workRemaining: boolean;
  workRollingFinished: boolean;
  completionReviewStatus: string | null;
  hasOpenUnmergedPr: boolean;
};

export type LiveRead = {
  readonly text: string;
};

export type LessonSource = "owner" | "repo" | "agent";

export type Lease = {
  key: string;
  repo: string;
  specId: string;
  clientAgentId: string;
  runId?: string;
  checkRoutineId?: string;
};

export type Ledger = {
  leases: Record<string, Lease>;
};

export type LaunchRef =
  | { kind: "spec-branch"; branch: string }
  | { kind: "pr"; head: string };

export type LaunchPayload = {
  prompt: { text: string };
  source: { repository: string; ref: string };
  clientAgentId: string;
  "work-on-current-branch"?: true;
};

export type ReserveResult =
  | { status: "reserved"; lease: Lease }
  | { status: "already"; lease: Lease }
  | { status: "cap_full" };

export type BotPaths = {
  home: string;
  liveHowToRun: string;
  memoryHowToRun: string;
  ledger: string;
  lock: string;
};

function reviewDone(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "done" || s === "ship";
}

export function botPaths(home: string): BotPaths {
  return {
    home,
    liveHowToRun: join(home, "how-to-run.md"),
    memoryHowToRun: join(home, "memory", "how-to-run.md"),
    ledger: join(home, "ledger", "leases.json"),
    lock: join(home, "ledger", "lock"),
  };
}

export function leaseKey(repo: string, specId: string): string {
  return `${repo} ${specId}`;
}

export function clientAgentIdFor(key: string): string {
  return createHash("sha256").update(`factory-client:${key}`).digest("hex");
}

export function classifyNextJob(fields: ClassifyFields): NamedJob {
  if (fields.specStatus === "merged" || fields.specStatus === "closed") return "stop";
  if (!fields.hasPlan) return "plan";
  if (!reviewDone(fields.planReviewStatus)) return "plan-review";
  if (fields.workRemaining || !fields.workRollingFinished) return "work-rolling";
  if (!reviewDone(fields.completionReviewStatus)) return "spec-completion-review";
  if (fields.hasOpenUnmergedPr) return "watch-or-fix";
  return "make-pr";
}

export function isBuildLaunchJob(job: NamedJob): boolean {
  return (
    job === "plan" ||
    job === "plan-review" ||
    job === "work-rolling" ||
    job === "spec-completion-review" ||
    job === "make-pr"
  );
}

export function requireLiveHowToRun(home: string): LiveRead | { error: "missing_live" } {
  const live = botPaths(home).liveHowToRun;
  if (!existsSync(live)) return { error: "missing_live" };
  return { text: readFileSync(live, "utf8") };
}

export function loadLiveHowToRun(home: string, templatePath: string): LiveRead {
  const live = botPaths(home).liveHowToRun;
  if (!existsSync(live)) {
    mkdirSync(dirname(live), { recursive: true });
    copyFileSync(templatePath, live);
  }
  return { text: readFileSync(live, "utf8") };
}

export function writeLesson(
  home: string,
  source: LessonSource,
  lesson: string,
): { ok: true } | { ok: false; reason: "untrusted_source" } {
  if (source !== "owner") return { ok: false, reason: "untrusted_source" };
  const paths = botPaths(home);
  mkdirSync(dirname(paths.liveHowToRun), { recursive: true });
  mkdirSync(dirname(paths.memoryHowToRun), { recursive: true });
  const body = lesson.endsWith("\n") ? lesson : `${lesson}\n`;
  writeFileSync(paths.liveHowToRun, body);
  writeFileSync(paths.memoryHowToRun, body);
  return { ok: true };
}

export function readLedgerFile(ledgerPath: string): Ledger {
  if (!existsSync(ledgerPath)) return { leases: {} };
  const parsed = JSON.parse(readFileSync(ledgerPath, "utf8")) as Ledger;
  return { leases: parsed.leases ?? {} };
}

function writeLedgerFile(ledgerPath: string, ledger: Ledger): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
}

function assertLeaseIdentity(repo: string, specId: string): void {
  if (!isRepoFullName(repo) || specId.trim() === "") {
    throw new Error("invalid lease identity");
  }
}

export async function reserveSlot(home: string, repo: string, specId: string): Promise<ReserveResult> {
  assertLeaseIdentity(repo, specId);
  const paths = botPaths(home);
  return withFileLock(paths.lock, async () => {
    const ledger = readLedgerFile(paths.ledger);
    const key = leaseKey(repo, specId);
    const existing = ledger.leases[key];
    if (existing) return { status: "already", lease: existing };
    if (Object.keys(ledger.leases).length >= FACTORY_CAP) return { status: "cap_full" };
    const lease: Lease = {
      key,
      repo,
      specId,
      clientAgentId: clientAgentIdFor(key),
    };
    ledger.leases[key] = lease;
    writeLedgerFile(paths.ledger, ledger);
    return { status: "reserved", lease };
  });
}

export async function clearLease(home: string, repo: string, specId: string): Promise<void> {
  const paths = botPaths(home);
  const key = leaseKey(repo, specId);
  await withFileLock(paths.lock, async () => {
    const ledger = readLedgerFile(paths.ledger);
    delete ledger.leases[key];
    writeLedgerFile(paths.ledger, ledger);
  });
}

export async function recordRunId(
  home: string,
  repo: string,
  specId: string,
  runId: string,
): Promise<void> {
  const paths = botPaths(home);
  const key = leaseKey(repo, specId);
  await withFileLock(paths.lock, async () => {
    const ledger = readLedgerFile(paths.ledger);
    const lease = ledger.leases[key];
    if (!lease) throw new Error("lease missing");
    lease.runId = runId;
    writeLedgerFile(paths.ledger, ledger);
  });
}

export function buildLaunchPayload(opts: {
  repo: string;
  ref: LaunchRef;
  clientAgentId: string;
  prompt: string;
}): LaunchPayload {
  const repository = `https://github.com/${opts.repo}`;
  if (opts.ref.kind === "pr") {
    return {
      prompt: { text: opts.prompt },
      source: { repository, ref: opts.ref.head },
      clientAgentId: opts.clientAgentId,
    };
  }
  return {
    prompt: { text: opts.prompt },
    source: { repository, ref: opts.ref.branch },
    clientAgentId: opts.clientAgentId,
    "work-on-current-branch": true,
  };
}

export type PickupResult =
  | { status: "launched"; payload: LaunchPayload; lease: Lease }
  | { status: "already"; lease: Lease }
  | { status: "wait" }
  | { status: "stop" }
  | { status: "watch-or-fix" }
  | { status: "ping"; reason: "cannot_launch" };

export async function pickupAndLaunch(opts: {
  home: string;
  templatePath: string;
  repo: string;
  specId: string;
  fields: ClassifyFields;
  ref: LaunchRef;
  canLaunch: boolean;
  post: (payload: LaunchPayload) => Promise<{ runId: string }>;
}): Promise<PickupResult> {
  loadLiveHowToRun(opts.home, opts.templatePath);
  const job = classifyNextJob(opts.fields);
  if (job === "stop") {
    await clearLease(opts.home, opts.repo, opts.specId);
    return { status: "stop" };
  }
  if (!opts.canLaunch) return { status: "ping", reason: "cannot_launch" };
  if (job === "watch-or-fix") return { status: "watch-or-fix" };

  const reserved = await reserveSlot(opts.home, opts.repo, opts.specId);
  if (reserved.status === "cap_full") return { status: "wait" };
  if (reserved.status === "already") return { status: "already", lease: reserved.lease };

  const payload = buildLaunchPayload({
    repo: opts.repo,
    ref: opts.ref,
    clientAgentId: reserved.lease.clientAgentId,
    prompt: job,
  });
  const { runId } = await opts.post(payload);
  await recordRunId(opts.home, opts.repo, opts.specId, runId);
  return { status: "launched", payload, lease: { ...reserved.lease, runId } };
}

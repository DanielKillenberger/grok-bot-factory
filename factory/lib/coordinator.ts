import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
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
  routines: string;
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
    routines: join(home, "routines"),
  };
}

export function leaseKey(repo: string, specId: string): string {
  return `${repo} ${specId}`;
}

export function clientAgentIdFor(key: string): string {
  return createHash("sha256").update(`factory-client:${key}`).digest("hex");
}

export function checkRoutineIdFor(key: string): string {
  return `factory-check:${key}`;
}

export type CheckPurpose = "build-run" | "pr-watch";

export type CheckRoutine = {
  id: string;
  repo: string;
  specId: string;
  intervalMinutes: 30;
  purpose: CheckPurpose;
};

export function checkRoutinePath(home: string, checkRoutineId: string): string {
  return join(botPaths(home).routines, `${checkRoutineId.replace(/[/\\]/g, "_")}.json`);
}

export function createNamedCheck(home: string, lease: Lease): { checkRoutineId: string } {
  const checkRoutineId = checkRoutineIdFor(lease.key);
  const path = checkRoutinePath(home, checkRoutineId);
  mkdirSync(dirname(path), { recursive: true });
  const routine: CheckRoutine = {
    id: checkRoutineId,
    repo: lease.repo,
    specId: lease.specId,
    intervalMinutes: 30,
    purpose: "build-run",
  };
  writeFileSync(path, `${JSON.stringify(routine, null, 2)}\n`);
  return { checkRoutineId };
}

export function readCheckRoutine(home: string, checkRoutineId: string): CheckRoutine | null {
  const path = checkRoutinePath(home, checkRoutineId);
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<CheckRoutine>;
  const purpose: CheckPurpose = parsed.purpose === "pr-watch" ? "pr-watch" : "build-run";
  return {
    id: parsed.id ?? checkRoutineId,
    repo: parsed.repo ?? "",
    specId: parsed.specId ?? "",
    intervalMinutes: 30,
    purpose,
  };
}

export function deleteCheck(home: string, checkRoutineId: string): { deleted: boolean } {
  const path = checkRoutinePath(home, checkRoutineId);
  if (!existsSync(path)) return { deleted: false };
  unlinkSync(path);
  return { deleted: true };
}

export function cancelBuildRunCheck(home: string, checkRoutineId: string): { cancelled: boolean } {
  const routine = readCheckRoutine(home, checkRoutineId);
  if (!routine) return { cancelled: false };
  if (routine.purpose === "pr-watch") return { cancelled: false };
  return { cancelled: deleteCheck(home, checkRoutineId).deleted };
}

export function retargetAsPrWatch(home: string, lease: Lease): { checkRoutineId: string } {
  const checkRoutineId = lease.checkRoutineId ?? checkRoutineIdFor(lease.key);
  const path = checkRoutinePath(home, checkRoutineId);
  mkdirSync(dirname(path), { recursive: true });
  const routine: CheckRoutine = {
    id: checkRoutineId,
    repo: lease.repo,
    specId: lease.specId,
    intervalMinutes: 30,
    purpose: "pr-watch",
  };
  writeFileSync(path, `${JSON.stringify(routine, null, 2)}\n`);
  return { checkRoutineId };
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

export type GitSidecarSpec = {
  status: string;
  plan_review_status?: string | null;
  completion_review_status?: string | null;
  impl_review_status?: string | null;
};

export type GitSidecarTask = {
  status: string;
};

export function fieldsFromGit(input: {
  spec: GitSidecarSpec;
  tasks: GitSidecarTask[];
  hasOpenUnmergedPr: boolean;
  hasPlan: boolean;
}): ClassifyFields {
  void input.spec.impl_review_status;
  const specStatus =
    input.spec.status === "merged" || input.spec.status === "closed"
      ? input.spec.status
      : "open";
  const taskStatuses = input.tasks.map((t) => t.status);
  const allDone = taskStatuses.length > 0 && taskStatuses.every((s) => s === "done");
  return {
    specStatus,
    hasPlan: input.hasPlan,
    planReviewStatus: input.spec.plan_review_status ?? null,
    workRemaining: !allDone,
    workRollingFinished: allDone,
    completionReviewStatus: input.spec.completion_review_status ?? null,
    hasOpenUnmergedPr: input.hasOpenUnmergedPr,
  };
}

export const JOB_SKILL: Record<Exclude<NamedJob, "stop" | "watch-or-fix">, string> = {
  plan: "/flow-next:plan",
  "plan-review": "/flow-next:plan-review",
  "work-rolling": "/flow-next:work-rolling",
  "spec-completion-review": "/flow-next:spec-completion-review",
  "make-pr": "/flow-next:make-pr",
};

export function promptForJob(job: NamedJob, specId: string): string {
  if (job === "stop") return "";
  if (job === "watch-or-fix") {
    return `CI/review fix for ${specId}. Stay on the spec branch or pull-request head.`;
  }
  if (job === "work-rolling") {
    return `${JOB_SKILL[job]} ${specId}. One agent. Review each finished task as it goes. Stay on the spec branch or pull-request head.`;
  }
  return `${JOB_SKILL[job]} ${specId}. Stay on the spec branch or pull-request head.`;
}

export function isGeneratedCursorBranch(branch: string): boolean {
  return branch === "cursor" || branch.startsWith("cursor/");
}

export function launchRefForPhase(input: {
  specBranch: string;
  prHead?: string | null;
  appearedBranch?: string | null;
}): LaunchRef {
  void input.appearedBranch;
  if (input.prHead && !isGeneratedCursorBranch(input.prHead)) {
    return { kind: "pr", head: input.prHead };
  }
  return { kind: "spec-branch", branch: input.specBranch };
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

export async function recordCheckRoutineId(
  home: string,
  repo: string,
  specId: string,
  checkRoutineId: string,
): Promise<void> {
  const paths = botPaths(home);
  const key = leaseKey(repo, specId);
  await withFileLock(paths.lock, async () => {
    const ledger = readLedgerFile(paths.ledger);
    const lease = ledger.leases[key];
    if (!lease) throw new Error("lease missing");
    lease.checkRoutineId = checkRoutineId;
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
  | { status: "ping"; reason: "cannot_launch" | "check_create_failed" };

export type ReadySpec = {
  specId: string;
  fields: ClassifyFields;
  ref: LaunchRef;
};

export async function pickupAndLaunch(opts: {
  home: string;
  templatePath: string;
  repo: string;
  specId: string;
  fields: ClassifyFields;
  ref: LaunchRef;
  canLaunch: boolean;
  post: (payload: LaunchPayload) => Promise<{ runId: string }>;
  createCheck?: (lease: Lease) => Promise<{ checkRoutineId: string } | { error: "cannot_create" }>;
  stopAgent?: (runId: string) => Promise<void>;
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
    prompt: promptForJob(job, opts.specId),
  });
  const { runId } = await opts.post(payload);
  await recordRunId(opts.home, opts.repo, opts.specId, runId);
  const createCheck =
    opts.createCheck ??
    (async (lease: Lease) => createNamedCheck(opts.home, lease));
  const check = await createCheck({ ...reserved.lease, runId });
  if ("error" in check) {
    if (opts.stopAgent) await opts.stopAgent(runId);
    await clearLease(opts.home, opts.repo, opts.specId);
    return { status: "ping", reason: "check_create_failed" };
  }
  await recordCheckRoutineId(opts.home, opts.repo, opts.specId, check.checkRoutineId);
  return {
    status: "launched",
    payload,
    lease: { ...reserved.lease, runId, checkRoutineId: check.checkRoutineId },
  };
}

export async function pickupReadySpecs(opts: {
  home: string;
  templatePath: string;
  repo: string;
  specs: ReadySpec[];
  canLaunch: boolean;
  post: (payload: LaunchPayload) => Promise<{ runId: string }>;
  createCheck?: (lease: Lease) => Promise<{ checkRoutineId: string } | { error: "cannot_create" }>;
  stopAgent?: (runId: string) => Promise<void>;
}): Promise<PickupResult[]> {
  loadLiveHowToRun(opts.home, opts.templatePath);
  const results: PickupResult[] = [];
  for (const spec of opts.specs) {
    const result = await pickupAndLaunch({
      ...opts,
      specId: spec.specId,
      fields: spec.fields,
      ref: spec.ref,
    });
    results.push(result);
    if (result.status === "wait") break;
  }
  return results;
}

export type RunStatus = "FINISHED" | "ERROR" | "RUNNING" | "GONE";

export type WakeHint = {
  finished?: boolean;
  transcriptPath?: string;
};

export type WakeArtifact =
  | { kind: "transcript"; path: string }
  | { kind: "git"; summary: string };

export type ArtifactReader = (input: {
  hint: WakeHint;
  runStatus: RunStatus;
}) => Promise<WakeArtifact | null>;

export type DoneWakeResult =
  | { status: "unknown"; cancelled: true; runStatus: RunStatus }
  | { status: "continue"; cancelled: true; runStatus: RunStatus; artifact: WakeArtifact }
  | { status: "judge"; cancelled: true }
  | { status: "stale"; cancelled: false };

export type CheckFireResult =
  | { status: "stop"; deleted: true; reason: "merged_or_cleared" | "orphan" }
  | { status: "pr-watch-or-fix"; deleted: false }
  | { status: "judge"; deleted: false }
  | DoneWakeResult;

function leaseCheckId(lease: Lease | undefined, repo: string, specId: string): string {
  return lease?.checkRoutineId ?? checkRoutineIdFor(leaseKey(repo, specId));
}

async function afterCancelledBuildRun(opts: {
  home: string;
  repo: string;
  specId: string;
  hint: WakeHint;
  runStatus: RunStatus;
  readArtifact: ArtifactReader;
  expectedRunId?: string;
}): Promise<DoneWakeResult> {
  const paths = botPaths(opts.home);
  const key = leaseKey(opts.repo, opts.specId);
  const lease = readLedgerFile(paths.ledger).leases[key];
  if (opts.expectedRunId && lease?.runId !== opts.expectedRunId) {
    return { status: "stale", cancelled: false };
  }
  cancelBuildRunCheck(opts.home, leaseCheckId(lease, opts.repo, opts.specId));
  if (opts.runStatus === "RUNNING") return { status: "judge", cancelled: true };
  const artifact = await opts.readArtifact({ hint: opts.hint, runStatus: opts.runStatus });
  if (!artifact) return { status: "unknown", cancelled: true, runStatus: opts.runStatus };
  return { status: "continue", cancelled: true, runStatus: opts.runStatus, artifact };
}

export async function handleDoneWake(opts: {
  home: string;
  repo: string;
  specId: string;
  runId: string;
  hint: WakeHint;
  getRun: (runId: string) => Promise<{ status: RunStatus }>;
  readArtifact: ArtifactReader;
}): Promise<DoneWakeResult> {
  const paths = botPaths(opts.home);
  const key = leaseKey(opts.repo, opts.specId);
  const lease = readLedgerFile(paths.ledger).leases[key];
  if (!lease?.runId || lease.runId !== opts.runId) {
    return { status: "stale", cancelled: false };
  }
  const checkRoutineId = leaseCheckId(lease, opts.repo, opts.specId);
  cancelBuildRunCheck(opts.home, checkRoutineId);
  const run = await opts.getRun(opts.runId);
  return afterCancelledBuildRun({
    home: opts.home,
    repo: opts.repo,
    specId: opts.specId,
    hint: opts.hint,
    runStatus: run.status,
    readArtifact: opts.readArtifact,
    expectedRunId: opts.runId,
  });
}

export async function handleCheckFire(opts: {
  home: string;
  repo: string;
  specId: string;
  specStatus: "open" | "merged" | "closed";
  leaseCleared?: boolean;
  hasOpenUnmergedPr: boolean;
  getRun: (runId: string) => Promise<{ status: RunStatus }>;
  readArtifact?: ArtifactReader;
}): Promise<CheckFireResult> {
  const paths = botPaths(opts.home);
  const key = leaseKey(opts.repo, opts.specId);
  const lease = opts.leaseCleared ? undefined : readLedgerFile(paths.ledger).leases[key];
  const checkRoutineId = leaseCheckId(lease, opts.repo, opts.specId);
  const purpose = readCheckRoutine(opts.home, checkRoutineId)?.purpose;

  if (opts.specStatus !== "open" || opts.leaseCleared || !lease) {
    deleteCheck(opts.home, checkRoutineId);
    return { status: "stop", deleted: true, reason: "merged_or_cleared" };
  }

  if (purpose === "pr-watch") {
    if (opts.hasOpenUnmergedPr) return { status: "pr-watch-or-fix", deleted: false };
    deleteCheck(opts.home, checkRoutineId);
    return { status: "stop", deleted: true, reason: "orphan" };
  }

  const observedRunId = lease.runId;
  const run = observedRunId ? await opts.getRun(observedRunId) : { status: "GONE" as const };
  if (run.status === "FINISHED" || run.status === "ERROR") {
    return afterCancelledBuildRun({
      home: opts.home,
      repo: opts.repo,
      specId: opts.specId,
      hint: {},
      runStatus: run.status,
      readArtifact: opts.readArtifact ?? (async () => null),
      expectedRunId: observedRunId,
    });
  }

  if (opts.hasOpenUnmergedPr && run.status !== "RUNNING") {
    retargetAsPrWatch(opts.home, lease);
    return { status: "pr-watch-or-fix", deleted: false };
  }

  if (run.status !== "RUNNING") {
    deleteCheck(opts.home, checkRoutineId);
    return { status: "stop", deleted: true, reason: "orphan" };
  }

  return { status: "judge", deleted: false };
}

export type StayAction = "retry" | "next-job" | "merge" | "fix-agent" | "ask" | "ping" | "hold";

export type NotifyHop = "ASKED" | "NEEDS_HUMAN" | "quiet";

export type JudgeInput = {
  readable: boolean;
  stillRunning?: boolean;
  finishedJob?: NamedJob;
  nextJob?: NamedJob;
  prMergeable?: boolean;
  ciOrReviewNeedsFix?: boolean;
  ownerAsk?: boolean;
  stuck?: boolean;
  retryable?: boolean;
  rounds?: number;
  lookCount?: number;
  wallClockMs?: number;
};

export type JudgeVerdict = {
  action: StayAction;
  notify: NotifyHop;
  invokeLand: false;
};

const LEAVES_FLIGHT: ReadonlySet<StayAction> = new Set(["merge", "ask", "ping"]);

export function notifyHopFor(action: StayAction): NotifyHop {
  if (action === "ask") return "ASKED";
  if (action === "ping") return "NEEDS_HUMAN";
  return "quiet";
}

export function notifyArgvForStay(action: StayAction, reason = ""): string[] | null {
  const hop = notifyHopFor(action);
  if (hop === "quiet") return null;
  return reason ? ["--event", hop, "--reason", reason] : ["--event", hop];
}

export function judgeStay(input: JudgeInput): JudgeVerdict {
  const finish = (action: StayAction): JudgeVerdict => ({
    action,
    notify: notifyHopFor(action),
    invokeLand: false,
  });

  if (input.ownerAsk) return finish("ask");
  if (input.stuck) return finish("ping");
  if (input.stillRunning || !input.readable) return finish("hold");
  if (input.retryable) return finish("retry");

  const afterMakePr = input.finishedJob === "make-pr" || input.nextJob === "watch-or-fix";
  if (afterMakePr) {
    if (input.ciOrReviewNeedsFix) return finish("fix-agent");
    if (input.prMergeable) return finish("merge");
    return finish("hold");
  }

  if (input.nextJob && input.nextJob !== "stop" && input.nextJob !== "watch-or-fix") {
    return finish("next-job");
  }

  return finish("hold");
}

export type StayCompletion = {
  action: StayAction;
  notify: NotifyHop;
  invokeLand: false;
  leaseCleared: boolean;
  checkDisabled: boolean;
  filled: PickupResult[];
  startedOtherRepo: false;
};

export async function completeStay(opts: {
  home: string;
  templatePath: string;
  firingRepo: string;
  specId: string;
  verdict: JudgeVerdict;
  readyInFiringRepo: ReadySpec[];
  readyInOtherRepos?: ReadySpec[];
  canLaunch: boolean;
  post: (payload: LaunchPayload) => Promise<{ runId: string }>;
  createCheck?: (lease: Lease) => Promise<{ checkRoutineId: string } | { error: "cannot_create" }>;
  stopAgent?: (runId: string) => Promise<void>;
}): Promise<StayCompletion> {
  void opts.readyInOtherRepos;
  let leaseCleared = false;
  let checkDisabled = false;
  let filled: PickupResult[] = [];

  if (LEAVES_FLIGHT.has(opts.verdict.action)) {
    const key = leaseKey(opts.firingRepo, opts.specId);
    const lease = readLedgerFile(botPaths(opts.home).ledger).leases[key];
    const checkId = leaseCheckId(lease, opts.firingRepo, opts.specId);
    deleteCheck(opts.home, checkId);
    await clearLease(opts.home, opts.firingRepo, opts.specId);
    leaseCleared = true;
    checkDisabled = readCheckRoutine(opts.home, checkId) === null;
    filled = await pickupReadySpecs({
      home: opts.home,
      templatePath: opts.templatePath,
      repo: opts.firingRepo,
      specs: opts.readyInFiringRepo,
      canLaunch: opts.canLaunch,
      post: opts.post,
      createCheck: opts.createCheck,
      stopAgent: opts.stopAgent,
    });
  }

  return {
    action: opts.verdict.action,
    notify: opts.verdict.notify,
    invokeLand: false,
    leaseCleared,
    checkDisabled,
    filled,
    startedOtherRepo: false,
  };
}

import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  FACTORY_CAP,
  SHIPPED_HOW_TO_RUN_TEMPLATE,
  botPaths,
  buildLaunchPayload,
  classifyNextJob,
  clientAgentIdFor,
  leaseKey,
  loadLiveHowToRun,
  checkRoutineIdFor,
  pickupAndLaunch,
  pickupReadySpecs,
  readLedgerFile,
  requireLiveHowToRun,
  reserveSlot,
  writeLesson,
  type ClassifyFields,
} from "../../factory/lib/coordinator.ts";
import { ROOT, SKILL, tempDir } from "./helpers.ts";

const COORD_SKILL = join(ROOT, "skills/factory-coordinator/SKILL.md");
const TEMPLATE = join(ROOT, "skills/factory-coordinator/assets/how-to-run.template.md");

const firstLaunch: ClassifyFields = {
  specStatus: "open",
  hasPlan: false,
  planReviewStatus: null,
  workRemaining: true,
  workRollingFinished: false,
  completionReviewStatus: null,
  hasOpenUnmergedPr: false,
};

let home = "";

beforeEach(() => {
  home = tempDir();
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

test("coordinator skill and template exist; template has no owner prefs", () => {
  expect(existsSync(COORD_SKILL)).toBe(true);
  expect(existsSync(TEMPLATE)).toBe(true);
  expect(TEMPLATE).toBe(SHIPPED_HOW_TO_RUN_TEMPLATE);
  const skill = readFileSync(COORD_SKILL, "utf8");
  const template = readFileSync(TEMPLATE, "utf8");
  expect(skill).toMatch(/^---\nname: factory-coordinator\n/m);
  expect(skill).toMatch(/allergic to idle/i);
  expect(skill).toMatch(/quiet when the inbox is empty|inbox is empty/i);
  expect(template.toLowerCase()).not.toMatch(/daniel|killenberger|cursor:|gpt-|claude-|always merge|never wait|i prefer|my preference/);
  expect(template).not.toMatch(/impl_review_status/);
});

test("builder exit 10 invokes the coordinator skill, not factory/tick.ts", () => {
  const skill = readFileSync(SKILL, "utf8");
  expect(skill).toMatch(/10 \| start[\s\S]*factory-coordinator/);
  expect(skill).toMatch(/Do not invoke `factory\/tick\.ts` on start/);
  expect(skill).not.toMatch(/10 \| start[\s\S]*`bun factory\/tick\.ts`/);
  expect(skill).toMatch(/0 \| quiet[\s\S]*No ping/);
  expect(skill).toMatch(/20 \| stuck[\s\S]*factory\/notify\.ts/);
});

test("ordered classify matrix lives in the skill and is used before the first launch", async () => {
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/spec merged or closed/);
  expect(skill).toMatch(/no plan/);
  expect(skill).toMatch(/plan-review not done/);
  expect(skill).toMatch(/work remains \/ work-rolling not finished/);
  expect(skill).toMatch(/completion-review status not done/);
  expect(skill).toMatch(/open unmerged PR/);
  expect(skill).toMatch(/no PR/);
  expect(skill).toMatch(/Do not invent `impl_review_status`/);
  expect(classifyNextJob(firstLaunch)).toBe("plan");

  let posted = false;
  const stopped = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: { ...firstLaunch, specStatus: "merged" },
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => {
      posted = true;
      return { runId: "run-1" };
    },
  });
  expect(stopped.status).toBe("stop");
  expect(posted).toBe(false);
});

test("missing live file is copied, then read, before any launch", async () => {
  const paths = botPaths(home);
  expect(requireLiveHowToRun(home)).toEqual({ error: "missing_live" });
  expect(existsSync(paths.liveHowToRun)).toBe(false);

  let liveAtPost = "";
  const result = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => {
      liveAtPost = readFileSync(paths.liveHowToRun, "utf8");
      return { runId: "run-1" };
    },
  });
  expect(result.status).toBe("launched");
  expect(liveAtPost).toBe(readFileSync(TEMPLATE, "utf8"));
  expect(loadLiveHowToRun(home, TEMPLATE).text).toBe(liveAtPost);
});

test("owner durable lesson writes live file and Bot memory; repo text and agent output cannot", () => {
  const paths = botPaths(home);
  const lesson = "Wait for green CI before merge.\n";
  expect(writeLesson(home, "repo", lesson)).toEqual({ ok: false, reason: "untrusted_source" });
  expect(writeLesson(home, "agent", lesson)).toEqual({ ok: false, reason: "untrusted_source" });
  expect(existsSync(paths.liveHowToRun)).toBe(false);
  expect(existsSync(paths.memoryHowToRun)).toBe(false);

  expect(writeLesson(home, "owner", lesson)).toEqual({ ok: true });
  expect(readFileSync(paths.liveHowToRun, "utf8")).toBe(lesson);
  expect(readFileSync(paths.memoryHowToRun, "utf8")).toBe(lesson);
});

test("launch payload sets work-on-current-branch for spec-branch jobs and uses the PR head when a PR exists", () => {
  const spec = buildLaunchPayload({
    repo: "acme/app",
    ref: { kind: "spec-branch", branch: "fn-4-factory-stay-worker" },
    clientAgentId: "abc",
    prompt: "plan",
  });
  expect(spec["work-on-current-branch"]).toBe(true);
  expect(spec.source.ref).toBe("fn-4-factory-stay-worker");
  expect(spec.source.repository).toBe("https://github.com/acme/app");

  const pr = buildLaunchPayload({
    repo: "acme/app",
    ref: { kind: "pr", head: "fn-4-pr-head" },
    clientAgentId: "abc",
    prompt: "watch-or-fix",
  });
  expect(pr["work-on-current-branch"]).toBeUndefined();
  expect(pr.source.ref).toBe("fn-4-pr-head");
});

test("lease key is repo plus spec id; lease and client agent id are written before POST", async () => {
  const key = leaseKey("acme/app", "fn-1");
  expect(key).toBe("acme/app fn-1");
  const wantId = clientAgentIdFor(key);
  let leaseAtPost: ReturnType<typeof readLedgerFile>["leases"][string] | undefined;

  const result = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async (payload) => {
      leaseAtPost = readLedgerFile(botPaths(home).ledger).leases[key];
      expect(payload.clientAgentId).toBe(wantId);
      return { runId: "run-1" };
    },
  });
  expect(result.status).toBe("launched");
  expect(leaseAtPost).toMatchObject({
    key,
    repo: "acme/app",
    specId: "fn-1",
    clientAgentId: wantId,
  });
  expect(leaseAtPost?.runId).toBeUndefined();
  expect(leaseAtPost?.checkRoutineId).toBeUndefined();
  const stored = readLedgerFile(botPaths(home).ledger).leases[key];
  expect(stored?.runId).toBe("run-1");
  expect(stored?.checkRoutineId).toBe(checkRoutineIdFor(key));
});

test("launch creates and persists the named per-spec 30-minute check; create fail stops the agent and pings", async () => {
  const key = leaseKey("acme/app", "fn-1");
  const ok = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => ({ runId: "run-1" }),
    createCheck: async () => ({ checkRoutineId: "routine-fn-1" }),
  });
  expect(ok.status).toBe("launched");
  if (ok.status !== "launched") return;
  expect(ok.lease.checkRoutineId).toBe("routine-fn-1");
  expect(readLedgerFile(botPaths(home).ledger).leases[key]?.checkRoutineId).toBe("routine-fn-1");

  const failHome = tempDir();
  const stopped: string[] = [];
  const failed = await pickupAndLaunch({
    home: failHome,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => ({ runId: "run-fail" }),
    createCheck: async () => ({ error: "cannot_create" }),
    stopAgent: async (runId) => {
      stopped.push(runId);
    },
  });
  expect(failed).toEqual({ status: "ping", reason: "check_create_failed" });
  expect(stopped).toEqual(["run-fail"]);
  expect(readLedgerFile(botPaths(failHome).ledger).leases[key]).toBeUndefined();
  rmSync(failHome, { recursive: true, force: true });
});

test("pickup starts every ready spec in the firing repo until the 10-spec cap", async () => {
  const posted: string[] = [];
  const results = await pickupReadySpecs({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    canLaunch: true,
    specs: Array.from({ length: FACTORY_CAP + 2 }, (_, i) => ({
      specId: `fn-${i}`,
      fields: firstLaunch,
      ref: { kind: "spec-branch" as const, branch: `fn-${i}` },
    })),
    post: async (payload) => {
      posted.push(payload.source.ref);
      return { runId: `run-${payload.source.ref}` };
    },
  });
  expect(results.filter((r) => r.status === "launched")).toHaveLength(FACTORY_CAP);
  expect(results.filter((r) => r.status === "wait")).toHaveLength(1);
  expect(posted).toHaveLength(FACTORY_CAP);
  expect(Object.keys(readLedgerFile(botPaths(home).ledger).leases)).toHaveLength(FACTORY_CAP);
  expect(results.at(-1)?.status).toBe("wait");
});

test("cross-repo lease keys do not collide", async () => {
  const a = await reserveSlot(home, "acme/app", "fn-1");
  const b = await reserveSlot(home, "other/app", "fn-1");
  expect(a.status).toBe("reserved");
  expect(b.status).toBe("reserved");
  if (a.status !== "reserved" || b.status !== "reserved") return;
  expect(a.lease.key).toBe("acme/app fn-1");
  expect(b.lease.key).toBe("other/app fn-1");
  expect(a.lease.key).not.toBe(b.lease.key);
  expect(a.lease.clientAgentId).not.toBe(b.lease.clientAgentId);
});

test("cap slots are reserved under one atomic lock; an 11th in-flight spec never starts", async () => {
  const results = await Promise.all(
    Array.from({ length: FACTORY_CAP + 1 }, (_, i) => reserveSlot(home, "acme/app", `fn-${i}`)),
  );
  expect(results.filter((r) => r.status === "reserved")).toHaveLength(FACTORY_CAP);
  expect(results.filter((r) => r.status === "cap_full")).toHaveLength(1);
  expect(Object.keys(readLedgerFile(botPaths(home).ledger).leases)).toHaveLength(FACTORY_CAP);

  const reserved = results.find((r) => r.status === "reserved");
  expect(reserved?.status).toBe("reserved");
  if (reserved?.status !== "reserved") return;
  const already = await reserveSlot(home, reserved.lease.repo, reserved.lease.specId);
  expect(already.status).toBe("already");
  if (already.status !== "already") return;
  expect(already.lease.key).toBe(reserved.lease.key);

  const eleventh = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-never",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-never" },
    canLaunch: true,
    post: async () => {
      throw new Error("11th spec must not POST");
    },
  });
  expect(eleventh.status).toBe("wait");
});

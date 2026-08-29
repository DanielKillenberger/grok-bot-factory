import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  SHIPPED_HOW_TO_RUN_TEMPLATE,
  botPaths,
  cancelBuildRunCheck,
  checkRoutinePath,
  createNamedCheck,
  deleteCheck,
  handleCheckFire,
  handleDoneWake,
  pickupAndLaunch,
  readCheckRoutine,
  readLedgerFile,
  recordRunId,
  retargetAsPrWatch,
  type ClassifyFields,
  type RunStatus,
} from "../../factory/lib/coordinator.ts";
import { ROOT, tempDir } from "./helpers.ts";

const COORD_SKILL = join(ROOT, "skills/factory-coordinator/SKILL.md");
const TEMPLATE = join(ROOT, "skills/factory-coordinator/assets/how-to-run.template.md");
const FORWARD = join(ROOT, ".github/workflows/factory-forward.yml");

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

async function seedBuildRun(runId = "run-1", specId = "fn-1") {
  const repo = "acme/app";
  const result = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo,
    specId,
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => ({ runId }),
  });
  expect(result.status).toBe("launched");
  if (result.status !== "launched") throw new Error("expected launch");
  return { repo, specId, lease: result.lease, checkRoutineId: result.lease.checkRoutineId! };
}

test("done-wake and a finished-check cancel the build-run check before the next action", async () => {
  const seeded = await seedBuildRun("run-wake");
  let checkAtGet: ReturnType<typeof readCheckRoutine> = readCheckRoutine(home, seeded.checkRoutineId);
  const wake = await handleDoneWake({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    runId: seeded.lease.runId!,
    hint: { finished: true, transcriptPath: "/tmp/transcript.json" },
    getRun: async () => {
      checkAtGet = readCheckRoutine(home, seeded.checkRoutineId);
      return { status: "FINISHED" };
    },
    readArtifact: async () => ({ kind: "transcript", path: "/tmp/transcript.json" }),
  });
  expect(checkAtGet).toBeNull();
  expect(wake).toEqual({
    status: "continue",
    cancelled: true,
    runStatus: "FINISHED",
    artifact: { kind: "transcript", path: "/tmp/transcript.json" },
  });
  expect(readCheckRoutine(home, seeded.checkRoutineId)).toBeNull();

  const again = await seedBuildRun("run-check", "fn-2");
  let checkAtRead: ReturnType<typeof readCheckRoutine> = readCheckRoutine(home, again.checkRoutineId);
  const fired = await handleCheckFire({
    home,
    repo: again.repo,
    specId: again.specId,
    specStatus: "open",
    hasOpenUnmergedPr: false,
    getRun: async () => ({ status: "FINISHED" }),
    readArtifact: async () => {
      checkAtRead = readCheckRoutine(home, again.checkRoutineId);
      return { kind: "git", summary: "plan committed" };
    },
  });
  expect(checkAtRead).toBeNull();
  expect(fired).toMatchObject({ status: "continue", cancelled: true, runStatus: "FINISHED" });
});

test("GET failure after cancel recreates the check so the hang detector stays", async () => {
  const seeded = await seedBuildRun("run-get-fail");
  const result = await handleDoneWake({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    runId: seeded.lease.runId!,
    hint: { finished: true },
    getRun: async () => {
      throw new Error("getRun failed");
    },
    readArtifact: async () => ({ kind: "git", summary: "unused" }),
  });
  expect(result).toEqual({ status: "judge", cancelled: false });
  expect(readCheckRoutine(home, seeded.checkRoutineId)).not.toBeNull();
});

test("FINISHED with no readable artifact is unknown, not phase done", async () => {
  const seeded = await seedBuildRun();
  const result = await handleDoneWake({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    runId: seeded.lease.runId!,
    hint: { finished: true },
    getRun: async () => ({ status: "FINISHED" }),
    readArtifact: async () => null,
  });
  expect(result).toEqual({ status: "unknown", cancelled: true, runStatus: "FINISHED" });
  expect(result.status).not.toBe("continue");
});

test("stale done-wake for a prior run does not cancel the current run's check", async () => {
  const seeded = await seedBuildRun("run-a");
  await recordRunId(home, seeded.repo, seeded.specId, "run-b");
  let gotRun: string | undefined;
  const stale = await handleDoneWake({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    runId: "run-a",
    hint: { finished: true },
    getRun: async (runId) => {
      gotRun = runId;
      return { status: "FINISHED" };
    },
    readArtifact: async () => ({ kind: "git", summary: "stale" }),
  });
  expect(stale).toEqual({ status: "stale", cancelled: false });
  expect(gotRun).toBeUndefined();
  expect(readCheckRoutine(home, seeded.checkRoutineId)).not.toBeNull();

  const missing = await handleDoneWake({
    home,
    repo: "acme/app",
    specId: "fn-missing",
    runId: "run-ghost",
    hint: { finished: true },
    getRun: async () => ({ status: "FINISHED" }),
    readArtifact: async () => ({ kind: "git", summary: "ghost" }),
  });
  expect(missing).toEqual({ status: "stale", cancelled: false });
});

test("done-wake does not cancel a replacement run's check created during GET", async () => {
  const seeded = await seedBuildRun("run-a");
  const result = await handleDoneWake({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    runId: "run-a",
    hint: { finished: true },
    getRun: async () => {
      await recordRunId(home, seeded.repo, seeded.specId, "run-b");
      const lease = readLedgerFile(botPaths(home).ledger).leases[`${seeded.repo} ${seeded.specId}`]!;
      createNamedCheck(home, { ...lease, runId: "run-b" });
      return { status: "FINISHED" };
    },
    readArtifact: async () => ({ kind: "git", summary: "old" }),
  });
  expect(result).toEqual({ status: "stale", cancelled: false });
  expect(readCheckRoutine(home, seeded.checkRoutineId)).not.toBeNull();

  const checkHome = home;
  const again = await seedBuildRun("run-c", "fn-check-rollover");
  const fired = await handleCheckFire({
    home: checkHome,
    repo: again.repo,
    specId: again.specId,
    specStatus: "open",
    hasOpenUnmergedPr: false,
    getRun: async () => {
      await recordRunId(checkHome, again.repo, again.specId, "run-d");
      const lease = readLedgerFile(botPaths(checkHome).ledger).leases[`${again.repo} ${again.specId}`]!;
      createNamedCheck(checkHome, { ...lease, runId: "run-d" });
      return { status: "FINISHED" };
    },
    readArtifact: async () => ({ kind: "git", summary: "old-check" }),
  });
  expect(fired).toEqual({ status: "stale", cancelled: false });
  expect(readCheckRoutine(checkHome, again.checkRoutineId)).not.toBeNull();
});

test("after make-pr, cancel then retarget the same per-spec routine as a PR watch", async () => {
  const seeded = await seedBuildRun();
  const id = seeded.checkRoutineId;
  expect(readCheckRoutine(home, id)?.purpose).toBe("build-run");

  cancelBuildRunCheck(home, id);
  expect(readCheckRoutine(home, id)).toBeNull();
  expect(existsSync(checkRoutinePath(home, id))).toBe(false);

  const retargeted = retargetAsPrWatch(home, seeded.lease);
  expect(retargeted.checkRoutineId).toBe(id);
  expect(readCheckRoutine(home, id)).toMatchObject({
    id,
    repo: seeded.repo,
    specId: seeded.specId,
    intervalMinutes: 30,
    purpose: "pr-watch",
  });
  expect(cancelBuildRunCheck(home, id)).toEqual({ cancelled: false });
  expect(readCheckRoutine(home, id)?.purpose).toBe("pr-watch");
});

test("check-fire order is merged/cleared, then PR-watch, then orphan-delete, then still-running judge", async () => {
  expect(TEMPLATE).toBe(SHIPPED_HOW_TO_RUN_TEMPLATE);
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/spec merged or lease cleared/);
  expect(skill).toMatch(/open unmerged PR and no build agent/);
  expect(skill).toMatch(/no agent and no open PR/);
  expect(skill).toMatch(/agent still running → judge/);
  expect(skill).toMatch(/Do not register a Cloud Agent HMAC receiver/);
  expect(skill).toMatch(/Do not add a factory-wide checker/);
  const forward = readFileSync(FORWARD, "utf8");
  expect(forward).toMatch(/Authorization: Bearer/);
  expect(forward).not.toMatch(/Cloud Agent HMAC|X-Cursor-Signature|webhook_secret/);

  const cases: Array<{
    name: string;
    specStatus: "open" | "merged" | "closed";
    leaseCleared?: boolean;
    hasOpenUnmergedPr: boolean;
    run: RunStatus;
    purpose?: "build-run" | "pr-watch";
    want: { status: string; reason?: string; deleted?: boolean };
  }> = [
    {
      name: "merged",
      specStatus: "merged",
      hasOpenUnmergedPr: true,
      run: "RUNNING",
      want: { status: "stop", reason: "merged_or_cleared", deleted: true },
    },
    {
      name: "lease cleared",
      specStatus: "open",
      leaseCleared: true,
      hasOpenUnmergedPr: false,
      run: "RUNNING",
      want: { status: "stop", reason: "merged_or_cleared", deleted: true },
    },
    {
      name: "open PR no agent",
      specStatus: "open",
      hasOpenUnmergedPr: true,
      run: "GONE",
      want: { status: "pr-watch-or-fix", deleted: false },
    },
    {
      name: "PR-watch purpose",
      specStatus: "open",
      hasOpenUnmergedPr: true,
      run: "FINISHED",
      purpose: "pr-watch",
      want: { status: "pr-watch-or-fix", deleted: false },
    },
    {
      name: "orphan",
      specStatus: "open",
      hasOpenUnmergedPr: false,
      run: "GONE",
      want: { status: "stop", reason: "orphan", deleted: true },
    },
    {
      name: "still running",
      specStatus: "open",
      hasOpenUnmergedPr: false,
      run: "RUNNING",
      want: { status: "judge", deleted: false },
    },
  ];

  for (const c of cases) {
    const caseHome = tempDir();
    const launched = await pickupAndLaunch({
      home: caseHome,
      templatePath: TEMPLATE,
      repo: "acme/app",
      specId: "fn-1",
      fields: firstLaunch,
      ref: { kind: "spec-branch", branch: "fn-1" },
      canLaunch: true,
      post: async () => ({ runId: `run-${c.name}` }),
    });
    expect(launched.status).toBe("launched");
    if (launched.status !== "launched") throw new Error(c.name);
    if (c.purpose === "pr-watch") retargetAsPrWatch(caseHome, launched.lease);
    const fired = await handleCheckFire({
      home: caseHome,
      repo: "acme/app",
      specId: "fn-1",
      specStatus: c.specStatus,
      leaseCleared: c.leaseCleared,
      hasOpenUnmergedPr: c.hasOpenUnmergedPr,
      getRun: async () => ({ status: c.run }),
      readArtifact: async () => ({ kind: "git", summary: c.name }),
    });
    expect(fired, c.name).toMatchObject(c.want);
    if (c.want.deleted) {
      expect(readCheckRoutine(caseHome, launched.lease.checkRoutineId!), c.name).toBeNull();
    } else {
      expect(readCheckRoutine(caseHome, launched.lease.checkRoutineId!), c.name).not.toBeNull();
    }
    if (c.name === "orphan" || c.name === "merged") {
      expect(
        readLedgerFile(botPaths(caseHome).ledger).leases["acme/app fn-1"],
        c.name,
      ).toBeUndefined();
    }
    rmSync(caseHome, { recursive: true, force: true });
  }
});

test("still-running check fire is coordinator judgment; no look-count auto-ping", async () => {
  const seeded = await seedBuildRun();
  const result = await handleCheckFire({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    specStatus: "open",
    hasOpenUnmergedPr: false,
    getRun: async () => ({ status: "RUNNING" }),
  });
  expect(result).toEqual({ status: "judge", deleted: false });
  expect(result).not.toHaveProperty("lookCount");
  expect(result).not.toHaveProperty("ping");
  expect(result.status).not.toBe("stop");
  expect(readCheckRoutine(home, seeded.checkRoutineId)?.purpose).toBe("build-run");
  expect("lookCount" in (readCheckRoutine(home, seeded.checkRoutineId) ?? {})).toBe(false);
});

test("PR-watch self-destructs on merge or cleared lease; open PR is not orphan-deleted", async () => {
  const seeded = await seedBuildRun();
  retargetAsPrWatch(home, seeded.lease);
  expect(readCheckRoutine(home, seeded.checkRoutineId)?.purpose).toBe("pr-watch");

  const kept = await handleCheckFire({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    specStatus: "open",
    hasOpenUnmergedPr: true,
    getRun: async () => {
      throw new Error("PR-watch must not GET a build run");
    },
  });
  expect(kept).toEqual({ status: "pr-watch-or-fix", deleted: false });
  expect(readCheckRoutine(home, seeded.checkRoutineId)?.purpose).toBe("pr-watch");

  const mergedHome = tempDir();
  const merged = await pickupAndLaunch({
    home: mergedHome,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => ({ runId: "run-merged" }),
  });
  expect(merged.status).toBe("launched");
  if (merged.status !== "launched") return;
  retargetAsPrWatch(mergedHome, merged.lease);
  const gone = await handleCheckFire({
    home: mergedHome,
    repo: "acme/app",
    specId: "fn-1",
    specStatus: "merged",
    hasOpenUnmergedPr: false,
    getRun: async () => ({ status: "GONE" }),
  });
  expect(gone).toEqual({ status: "stop", deleted: true, reason: "merged_or_cleared" });
  expect(readCheckRoutine(mergedHome, merged.lease.checkRoutineId!)).toBeNull();

  deleteCheck(home, seeded.checkRoutineId);
  retargetAsPrWatch(home, seeded.lease);
  const cleared = await handleCheckFire({
    home,
    repo: seeded.repo,
    specId: seeded.specId,
    specStatus: "open",
    leaseCleared: true,
    hasOpenUnmergedPr: true,
    getRun: async () => ({ status: "GONE" }),
  });
  expect(cleared).toEqual({ status: "stop", deleted: true, reason: "merged_or_cleared" });
  expect(readCheckRoutine(home, seeded.checkRoutineId)).toBeNull();
  rmSync(mergedHome, { recursive: true, force: true });
});

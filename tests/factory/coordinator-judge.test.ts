import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  FACTORY_CAP,
  botPaths,
  completeStay,
  judgeStay,
  notifyArgvForStay,
  pickupAndLaunch,
  readCheckRoutine,
  readLedgerFile,
  reserveSlot,
  type ClassifyFields,
  type JudgeInput,
  type StayAction,
} from "../../factory/lib/coordinator.ts";
import { NOTIFY, ROOT, runBun, tempDir } from "./helpers.ts";

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

test("after a readable result the stay chooses retry, next-job, merge, fix-agent, ask, or ping", () => {
  const cases: Array<[StayAction, JudgeInput]> = [
    ["retry", { readable: true, finishedJob: "plan", retryable: true }],
    ["next-job", { readable: true, finishedJob: "plan", nextJob: "plan-review" }],
    ["merge", { readable: true, finishedJob: "make-pr", prMergeable: true }],
    ["fix-agent", { readable: true, finishedJob: "make-pr", ciOrReviewNeedsFix: true }],
    ["ask", { readable: true, ownerAsk: true, rounds: 3 }],
    ["ping", { readable: true, stuck: true, rounds: 3 }],
  ];
  for (const [action, input] of cases) {
    expect(judgeStay(input).action, action).toBe(action);
    expect(judgeStay(input).invokeLand, action).toBe(false);
  }
});

test("rounds and look-count never auto-ping", () => {
  const progressing = judgeStay({
    readable: true,
    finishedJob: "work-rolling",
    nextJob: "spec-completion-review",
    rounds: 8,
    lookCount: 12,
    wallClockMs: 30 * 60 * 1000,
  });
  expect(progressing.action).toBe("next-job");
  expect(progressing.notify).toBe("quiet");

  const stillRunning = judgeStay({
    readable: true,
    stillRunning: true,
    rounds: 8,
    lookCount: 99,
    wallClockMs: 8 * 30 * 60 * 1000,
  });
  expect(stillRunning.action).not.toBe("ping");
  expect(stillRunning.action).not.toBe("ask");
  expect(stillRunning.notify).toBe("quiet");
});

test("after make-pr the coordinator merges or sends a fix agent and does not invoke land", () => {
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/After make-pr/);
  expect(skill).toMatch(/Do not invoke land/);
  expect(skill).toMatch(/Stopping at make-pr or PR-up fails the stay/);

  const merge = judgeStay({ readable: true, finishedJob: "make-pr", prMergeable: true });
  expect(merge.action).toBe("merge");
  expect(merge.invokeLand).toBe(false);
  expect(merge.notify).toBe("quiet");

  const fix = judgeStay({
    readable: true,
    finishedJob: "make-pr",
    nextJob: "watch-or-fix",
    ciOrReviewNeedsFix: true,
  });
  expect(fix.action).toBe("fix-agent");
  expect(fix.invokeLand).toBe(false);

  const prUp = judgeStay({ readable: true, nextJob: "watch-or-fix" });
  expect(prUp.action).not.toBe("ping");
  expect(prUp.invokeLand).toBe(false);
});

test("ask and stuck use the notify hop; coordinator merge is quiet", async () => {
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/factory\/notify\.ts/);
  expect(skill).toMatch(/builder → main → human/);
  expect(skill).toMatch(/Coordinator merge is quiet/);
  expect(skill).toMatch(/owner-gated `merge` \/ `DEFERRED_TO_LAND`/);

  expect(notifyArgvForStay("ask")).toEqual(["--event", "ASKED"]);
  expect(notifyArgvForStay("ping", "stuck")).toEqual([
    "--event",
    "NEEDS_HUMAN",
    "--reason",
    "stuck",
  ]);
  expect(notifyArgvForStay("merge")).toBeNull();

  const asked = await runBun(NOTIFY, notifyArgvForStay("ask")!);
  expect(asked.code).toBe(0);
  expect(JSON.parse(asked.stdout)).toMatchObject({
    event: "ASKED",
    path: "builder->main->human",
  });

  const stuck = await runBun(NOTIFY, notifyArgvForStay("ping")!);
  expect(stuck.code).toBe(0);
  expect(JSON.parse(stuck.stdout)).toMatchObject({
    event: "NEEDS_HUMAN",
    path: "builder->main->human",
  });

  expect(judgeStay({ readable: true, finishedJob: "make-pr", prMergeable: true }).notify).toBe(
    "quiet",
  );
});

test("escalate clears the lease and disables the check", async () => {
  const launched = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-1",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-1" },
    canLaunch: true,
    post: async () => ({ runId: "run-escalate" }),
  });
  expect(launched.status).toBe("launched");
  if (launched.status !== "launched") return;
  const checkId = launched.lease.checkRoutineId!;
  expect(readCheckRoutine(home, checkId)).not.toBeNull();

  const done = await completeStay({
    home,
    templatePath: TEMPLATE,
    firingRepo: "acme/app",
    specId: "fn-1",
    verdict: judgeStay({ readable: true, stuck: true }),
    readyInFiringRepo: [],
    canLaunch: true,
    post: async () => {
      throw new Error("escalate must not launch");
    },
  });
  expect(done.action).toBe("ping");
  expect(done.leaseCleared).toBe(true);
  expect(done.checkDisabled).toBe(true);
  expect(readLedgerFile(botPaths(home).ledger).leases["acme/app fn-1"]).toBeUndefined();
  expect(readCheckRoutine(home, checkId)).toBeNull();
});

test("freed slot under 10 fills from the firing repo only; cap-full is quiet wait", async () => {
  for (let i = 0; i < FACTORY_CAP - 1; i++) {
    expect((await reserveSlot(home, "other/app", `fn-other-${i}`)).status).toBe("reserved");
  }
  const leaving = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-leave",
    fields: firstLaunch,
    ref: { kind: "spec-branch", branch: "fn-leave" },
    canLaunch: true,
    post: async () => ({ runId: "run-leave" }),
  });
  expect(leaving.status).toBe("launched");

  const posted: string[] = [];
  const filled = await completeStay({
    home,
    templatePath: TEMPLATE,
    firingRepo: "acme/app",
    specId: "fn-leave",
    verdict: judgeStay({ readable: true, finishedJob: "make-pr", prMergeable: true }),
    readyInFiringRepo: [
      { specId: "fn-next", fields: firstLaunch, ref: { kind: "spec-branch", branch: "fn-next" } },
    ],
    readyInOtherRepos: [
      { specId: "fn-skip", fields: firstLaunch, ref: { kind: "spec-branch", branch: "fn-skip" } },
    ],
    canLaunch: true,
    post: async (payload) => {
      posted.push(`${payload.source.repository} ${payload.source.ref}`);
      return { runId: `run-${payload.source.ref}` };
    },
  });
  expect(filled.startedOtherRepo).toBe(false);
  expect(filled.filled.filter((r) => r.status === "launched")).toHaveLength(1);
  expect(posted).toEqual(["https://github.com/acme/app fn-next"]);
  expect(readLedgerFile(botPaths(home).ledger).leases["other/app fn-skip"]).toBeUndefined();

  const fullHome = tempDir();
  for (let i = 0; i < FACTORY_CAP; i++) {
    expect((await reserveSlot(fullHome, "other/app", `fn-full-${i}`)).status).toBe("reserved");
  }
  const quiet = await completeStay({
    home: fullHome,
    templatePath: TEMPLATE,
    firingRepo: "acme/app",
    specId: "fn-ghost",
    verdict: judgeStay({ readable: true, finishedJob: "make-pr", prMergeable: true }),
    readyInFiringRepo: [
      { specId: "fn-ready", fields: firstLaunch, ref: { kind: "spec-branch", branch: "fn-ready" } },
    ],
    readyInOtherRepos: [
      { specId: "fn-also", fields: firstLaunch, ref: { kind: "spec-branch", branch: "fn-also" } },
    ],
    canLaunch: true,
    post: async () => {
      throw new Error("cap-full must not POST");
    },
  });
  expect(quiet.notify).toBe("quiet");
  expect(quiet.startedOtherRepo).toBe(false);
  expect(quiet.filled).toEqual([{ status: "wait" }]);
  expect(quiet.filled[0]?.status).not.toBe("ping");
  rmSync(fullHome, { recursive: true, force: true });
});

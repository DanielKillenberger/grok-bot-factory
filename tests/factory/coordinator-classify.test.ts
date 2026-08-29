import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  JOB_SKILL,
  classifyNextJob,
  fieldsFromGit,
  launchRefForPhase,
  pickupAndLaunch,
  promptForJob,
  type ClassifyFields,
  type NamedJob,
} from "../../factory/lib/coordinator.ts";
import { ROOT, memoryCheckClock, tempDir } from "./helpers.ts";

const COORD_SKILL = join(ROOT, "skills/factory-coordinator/SKILL.md");
const TEMPLATE = join(ROOT, "skills/factory-coordinator/assets/how-to-run.template.md");

const afterWorkRolling: ClassifyFields = {
  specStatus: "open",
  hasPlan: true,
  planReviewStatus: "ship",
  workRemaining: false,
  workRollingFinished: true,
  completionReviewStatus: "unknown",
  hasOpenUnmergedPr: false,
};

function sidecarFields(opts: {
  completion?: string | null;
  implReview?: string | null;
  hasOpenUnmergedPr?: boolean;
  taskStatuses?: string[];
}): ClassifyFields {
  return fieldsFromGit({
    spec: {
      status: "open",
      plan_review_status: "ship",
      completion_review_status: opts.completion ?? "unknown",
      impl_review_status: opts.implReview,
    },
    tasks: (opts.taskStatuses ?? ["done", "done"]).map((status) => ({ status })),
    hasOpenUnmergedPr: opts.hasOpenUnmergedPr ?? false,
    hasPlan: true,
  });
}

let home = "";

beforeEach(() => {
  home = tempDir();
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

test("after work-rolling, restart classifies spec-completion-review from the task-1 matrix", () => {
  expect(classifyNextJob(afterWorkRolling)).toBe("spec-completion-review");
  expect(classifyNextJob(sidecarFields({}))).toBe("spec-completion-review");
});

test("completion-review not_required is done and does not relaunch completion-review", () => {
  expect(classifyNextJob({ ...afterWorkRolling, completionReviewStatus: "not_required" })).toBe(
    "make-pr",
  );
  expect(classifyNextJob(sidecarFields({ completion: "not_required" }))).toBe("make-pr");
  expect(classifyNextJob(sidecarFields({ completion: "not_required", hasOpenUnmergedPr: true }))).toBe(
    "watch-or-fix",
  );
});

test("open PR before completion-review is done classifies as spec-completion-review, not merge", () => {
  const fields = sidecarFields({ hasOpenUnmergedPr: true, completion: "unknown" });
  expect(classifyNextJob(fields)).toBe("spec-completion-review");
  expect(classifyNextJob(fields)).not.toBe("watch-or-fix");
  expect(classifyNextJob(fields)).not.toBe("make-pr");
  expect(classifyNextJob({ ...afterWorkRolling, hasOpenUnmergedPr: true })).toBe(
    "spec-completion-review",
  );
});

test("successful work-rolling is not followed by a standalone impl-review", () => {
  const missingField = sidecarFields({ implReview: undefined });
  const inventedMissing = sidecarFields({ implReview: null });
  expect(classifyNextJob(missingField)).toBe("spec-completion-review");
  expect(classifyNextJob(inventedMissing)).toBe("spec-completion-review");
  expect(classifyNextJob(afterWorkRolling)).not.toBe("impl-review" as NamedJob);
  expect(promptForJob("spec-completion-review", "fn-4")).not.toMatch(/\/flow-next:impl-review/);
  expect(promptForJob("work-rolling", "fn-4")).toMatch(/\/flow-next:work-rolling/);
  expect(promptForJob("work-rolling", "fn-4")).not.toMatch(/\/flow-next:impl-review/);
});

test("later review or CI problems classify as a CI/review fix agent, not impl-review", () => {
  const fields = sidecarFields({ completion: "done", hasOpenUnmergedPr: true });
  expect(classifyNextJob(fields)).toBe("watch-or-fix");
  const prompt = promptForJob("watch-or-fix", "fn-4");
  expect(prompt).toMatch(/CI\/review fix/);
  expect(prompt).not.toMatch(/impl-review/);
  expect(prompt).not.toMatch(/\/flow-next:land|\bland\b|\/pilot/);
});

test("prompts name the matching flow-next skill, stay on spec or PR branch, and do not invoke land", async () => {
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/\/flow-next:plan/);
  expect(skill).toMatch(/\/flow-next:plan-review/);
  expect(skill).toMatch(/\/flow-next:work-rolling/);
  expect(skill).toMatch(/\/flow-next:spec-completion-review/);
  expect(skill).toMatch(/\/flow-next:make-pr/);
  expect(skill).toMatch(/Do not invoke land/);
  expect(skill).toMatch(/Do not invent `\/pilot`/);
  expect(skill).toMatch(/Do not follow a generated cursor branch/);

  const jobs = Object.entries(JOB_SKILL) as Array<[keyof typeof JOB_SKILL, string]>;
  for (const [job, named] of jobs) {
    const prompt = promptForJob(job, "fn-4");
    expect(prompt, job).toContain(named);
    expect(prompt, job).not.toMatch(/\/flow-next:land|\bland\b|\/pilot|\/flow-next:impl-review/);
  }

  expect(launchRefForPhase({ specBranch: "fn-4", appearedBranch: "cursor/abc-123" })).toEqual({
    kind: "spec-branch",
    branch: "fn-4",
  });
  expect(
    launchRefForPhase({
      specBranch: "fn-4",
      prHead: "fn-4-pr-head",
      appearedBranch: "cursor/abc-123",
    }),
  ).toEqual({ kind: "pr", head: "fn-4-pr-head" });

  const launched = await pickupAndLaunch({
    home,
    templatePath: TEMPLATE,
    repo: "acme/app",
    specId: "fn-4",
    fields: afterWorkRolling,
    ref: launchRefForPhase({ specBranch: "fn-4", appearedBranch: "cursor/abc-123" }),
    canLaunch: true,
    clock: memoryCheckClock(),
    post: async (payload) => {
      expect(payload.prompt.text).toContain("/flow-next:spec-completion-review");
      expect(payload.prompt.text).not.toMatch(/\/flow-next:land|\bland\b|\/pilot|\/flow-next:impl-review/);
      expect(payload.source.ref).toBe("fn-4");
      expect(payload["work-on-current-branch"]).toBe(true);
      return { runId: "run-classify" };
    },
  });
  expect(launched.status).toBe("launched");
});

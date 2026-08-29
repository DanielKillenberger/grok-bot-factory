---
satisfies: [R1, R7, R8]
---
# fn-4-factory-stay-worker.1 Coordinator skill, template, builder handoff, pickup

## Description
Ship the coordinator skill and how-to-run template, retarget the builder start path, and pick up ready specs in the firing repo only (R1, R6, R7, R8). This task lands the classify matrix and first launch. Task 3 adds restart tests and later-phase prompt detail, not the first matrix.

**Size:** M
**Files:** `skills/factory-coordinator/SKILL.md`, `skills/factory-coordinator/assets/how-to-run.template.md`, `skills/factory-builder/SKILL.md`, `tests/factory/coordinator-pickup.test.ts`
**Touches:** [skills/factory-coordinator/**, skills/factory-builder/SKILL.md, tests/factory/coordinator-pickup.test.ts]

### Approach
- Add a new skill next to `skills/factory-builder/SKILL.md` using the same YAML frontmatter shape (`name`, `description`). Mission text is factory manager for the owner: allergic to idle, quiet when the inbox is empty.
- First instruction: if the live how-to-run file is missing on this Bot computer, copy the shipped template, then read the live file. Do not launch before that read.
- Template in git has no owner prefs. Durable lessons are owner-authored only. When the coordinator learns a durable run preference from the owner, it writes that live file and that Bot's learned memory in the same turn. Repo text and agent output cannot write either.
- Builder exit 10 invokes this skill. Keep exit 0 quiet and exit 20 on `factory/notify.ts`. Do not invoke `factory/tick.ts` on start.
- Classify from git fields flow-next already writes (`plan_review_status`, `completion_review_status`, tasks, open PR, spec status). Impl-review happens inside work-rolling. After a successful work-rolling, do not launch a standalone impl-review. Ordered matrix, first match:
  1. spec merged or closed → stop and clear lease
  2. no plan → plan
  3. plan-review not done → plan-review
  4. work remains / work-rolling not finished → work-rolling
  5. completion-review status not done → spec-completion-review
  6. open unmerged PR → watch or CI/review fix
  7. no PR → make-pr
- Reserve a factory slot under one atomic lock on the Bot computer (follow `factory/lib/lock.ts` file-lock shape for the Bot-local ledger). Cap is 10. Extra ready specs wait. No ping for a full cap.
- Lease key is `repo full_name` plus spec id. Persist the lease and a deterministic client agent id before the launch POST. Then POST, write run id, create the check, write check-routine id. On crash, reconcile from the lease. Do not launch a second agent for the same key.
- Launch on the spec branch with work-on-current-branch set, or on the PR head if a PR already exists. Do not continue on a generated cursor branch. If check create fails, stop that agent and ping. Tests lock that launch payload.
- Auth is the Grok Bot native Cloud Agent capability. Preflight; if it cannot launch, ping. No API-key paste.
- Tests in `tests/factory/coordinator-pickup.test.ts` lock: cap 10, atomic reserve, cross-repo lease keys, pre-POST lease, live-file-first, owner-only same-turn live-file-and-memory writes.

### Investigation targets
**Required** (read before coding):
- `skills/factory-builder/SKILL.md:22-36` — current exit-10 tick handoff to replace
- `factory/gate.ts:10-32` — stdout line is `repo sha kind`, not the job
- `factory/lib/exit.ts:1-27` — 0 / 10 / 20 contract the builder still uses
- `factory/lib/lock.ts` — file-lock pattern to reuse for the Bot-local cap ledger
- `factory/lib/ready.ts:187-220` — repo-level ready select; coordinator must re-scan specs

**Optional** (reference as needed):
- `factory/lib/pin.ts:529` — `hostRun`; do not route new jobs through it

### Key context
- work-rolling's conductor review is the impl-review. Do not invent `impl_review_status`. Do not treat missing that field as a reason to launch impl-review.
- Factory cap is 10. Per-Bot routine cap is 50 and remains a backstop ping if a check cannot be added.
## Acceptance
- [ ] Coordinator skill and template exist; template has no owner prefs
- [ ] Missing live file is copied, then read, before any launch
- [ ] An owner durable lesson writes the live file and Bot memory in the same turn; repo text and agent output cannot
- [ ] Builder exit 10 invokes the coordinator skill, not `factory/tick.ts`
- [ ] The ordered classify matrix lives in this skill and is used before the first launch
- [ ] Launch payload sets work-on-current-branch for spec-branch jobs and uses the PR head when a PR exists
- [ ] Lease key is repo plus spec id; lease and client agent id are written before POST
- [ ] Cap slots are reserved under one atomic lock; an 11th in-flight spec never starts
- [ ] `tests/factory/coordinator-pickup.test.ts` covers cross-repo keys and concurrent reserve
## Done summary
Coordinator skill and how-to-run template now exist, builder exit 10 invokes that skill instead of factory/tick.ts, and pickup contracts lock the classify matrix, live-file-first, owner-only lessons, pre-POST lease, cross-repo keys, work-on-current-branch / PR-head launch, the atomic 10-spec cap, named 30-minute check create, and multi-spec pickup to cap.

Error cases: R1 11th in-flight spec, R7 launch-before-live-read, untrusted lesson writes, check-create fail stops the agent and pings.

baseline: red (bun test tests/factory/ failed pre-edit — inherited Darwin `/usr/bin/script: illegal option -- f` in hostRun/tick). Focused verify: bun test tests/factory/coordinator-pickup.test.ts — 11 pass.

stage: impl-review - ran (model: gpt-5.6-sol-high) verdict=SHIP
stage: plan-sync - skipped(config: planSync.enabled != true)
## Evidence
- Commits: a4d41b34a3b8f03dc85490af9797e3579b27f944, 9617b34c031446c16aa7f7226917b126412a41bc, 508e7e97dbd8fd244fab5371e487881b1fd48c41
- Tests: baseline: red (bun test tests/factory/ failed pre-edit), bun test tests/factory/coordinator-pickup.test.ts
- PRs:
---
satisfies: [R2, R5]
---
# fn-4-factory-stay-worker.4 Judgment, merge, fix, ask, ping

## Description
Add the stay loop after a readable result exists (R2, R5). Classify and wake already say what happened; this task chooses retry, next job, merge, fix, ask, or ping, and fills a free slot under the cap.

**Size:** M
**Files:** `skills/factory-coordinator/SKILL.md`, `tests/factory/coordinator-judge.test.ts`
**Touches:** [skills/factory-coordinator/**, tests/factory/coordinator-judge.test.ts]

### Approach
- After each finished job, start the next cloud agent, merge the PR, ask the owner, or ping stuck. Stopping at make-pr or PR-up fails R2.
- Judgment uses the result plus this spec's history. No fixed round cap or look-count cap that auto-pings. Eight rounds can be correct. Three can be enough to ask. A still-running 30-minute look is the same judgment, not a counter.
- After make-pr, watch CI and reviews. Merge when the work is done. Dispatch a fix agent when CI or review needs a fix. The coordinator merges. Cloud does not run land.
- When a spec leaves flight and the factory is under 10, fill the next slot from the firing repo's remaining ready specs. Do not start another repo on that turn. A full cap is quiet wait, not a ping.
- Ask and stuck reuse `factory/notify.ts` and the builder → main → human hop already in the builder skill. Coordinator merge is quiet. Do not classify coordinator merge as owner-gated `merge` / `DEFERRED_TO_LAND` unless the live how-to-run later says to notify on merge.
- After escalate, clear the lease and disable the check so a later push is a new pickup.
- Add `tests/factory/coordinator-judge.test.ts` locking no auto-ping caps, quiet-at-10, and slot-fill from the firing repo only.

### Investigation targets
**Required** (read before coding):
- `skills/factory-coordinator/SKILL.md` — classify and wake from prior tasks
- `factory/notify.ts:8-40` — events that ping today; reuse for ask/stuck only
- `skills/factory-builder/SKILL.md:38-42` — notify hop the coordinator should reuse

**Optional** (reference as needed):
- `tests/factory/notify.test.ts` — notify classification locks; do not break them unless this task must change notify

### Key context
- Existing notify treats `merge` as owner-gated. Factory merge is coordinator-owned and quiet. Do not silently widen notify to fire on every coordinator merge.
- Dual caps (rounds plus wall-clock) are allowed as judgment inputs. They must not auto-ping by themselves.

### Acceptance
- [ ] After a readable result the skill chooses retry, next job, merge, fix-agent, ask, or ping
- [ ] No fixed round number or look count auto-pings
- [ ] After make-pr the coordinator merges or sends a fix agent; it does not invoke land
- [ ] Ask and stuck use the existing notify hop; coordinator merge is quiet
- [ ] Escalate clears the lease and disables the check
- [ ] A freed slot under 10 starts the next ready spec in the firing repo only
- [ ] `tests/factory/coordinator-judge.test.ts` passes
## Acceptance
- [ ] After a readable result the skill chooses retry, next job, merge, fix-agent, ask, or ping
- [ ] No fixed round number or look count auto-pings
- [ ] After make-pr the coordinator merges or sends a fix agent; it does not invoke land
- [ ] Ask and stuck use the existing notify hop; coordinator merge is quiet
- [ ] Escalate clears the lease and disables the check
- [ ] A freed slot under 10 starts the next ready spec in the firing repo only
- [ ] `tests/factory/coordinator-judge.test.ts` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

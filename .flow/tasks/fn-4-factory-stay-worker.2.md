---
satisfies: [R4]
---
# fn-4-factory-stay-worker.2 Done-wake and 30-minute check lifecycle

## Description
Teach the coordinator skill the hang backstop and the Cloud-done continue path (R4). Depends on pickup already creating a named per-spec check and persisting ids.

**Size:** M
**Files:** `skills/factory-coordinator/SKILL.md`, `tests/factory/coordinator-wake.test.ts`
**Touches:** [skills/factory-coordinator/**, tests/factory/coordinator-wake.test.ts]

### Approach
- Happy path: Cloud Agent finish or error wakes the coordinator (R4, factory-proven revival on `bc-22b79c9f-d5f7-4d9b-9180-ab265f5f8ec0`; payload is finished plus transcript, not a verdict). Cancel the check that was watching that run first. Then GET the run (run status is truth, not a done-wake hint). Read the result from the agent or from git, using the persisted ids.
- The 30-minute check is the guaranteed detector if the done-wake never fires. Treat a check fire that finds a finished or errored run the same as a done-wake: cancel that build-run check, then act.
- A FINISHED run with no readable artifact is unknown. Do not treat it as phase done.
- Each spec has at most one 30-minute routine. Cancel means stop the hang detector for a finished Cloud Agent. After make-pr, create or retarget that same per-spec routine as a PR watch. Do not keep a cancelled build-run check firing, and do not orphan-delete an open-PR check.
- Check-fire state order is mandatory: (1) spec merged or lease cleared → delete check and stop; (2) open unmerged PR and no build agent → PR watch or fix, do not orphan-delete; (3) no agent and no open PR → delete the check and stop, no ping, no new tick; (4) agent still running → judge (R5).
- Do not register a Cloud Agent HMAC receiver as the factory-forward webhook. Do not add a factory-wide checker.
- After merge or escalate, delete leftover checks so they do not consume the per-Bot routine cap.
- Add `tests/factory/coordinator-wake.test.ts` locking that state order, unknown-finish, cancel-then-retarget after make-pr, and PR-watch vs orphan-delete.

### Investigation targets
**Required** (read before coding):
- `skills/factory-coordinator/SKILL.md` — pickup, ids, and launch from the prior task
- `.github/workflows/factory-forward.yml` — factory Bearer webhook; must stay unrelated to Cloud HMAC
- `factory/lib/exit.ts:1-27` — stuck vs quiet if a check path must fail closed

**Optional** (reference as needed):
- `factory/notify.ts:8-18` — stuck hop exists; this task does not change notify classification

### Key context
- Cloud Agents v1: poll run status (`FINISHED` / `ERROR`), not agent ACTIVE/IDLE. SSE `done` is an empty object. Follow-up runs use the runs endpoint. `409 agent_busy` means do not pile a follow-up on a live run.
- Cloud Agents v0 HMAC to a caller URL is a different product. Using it as the factory gate webhook fails closed.
- Hiding a Bot does not pause routines. Delete checks you no longer need.
## Acceptance
- [ ] Done-wake or a check that finds a finished run cancels that build-run check before the next action
- [ ] Finish with no readable result is not phase done
- [ ] After make-pr, the same per-spec routine is created or retargeted as a PR watch (not left cancelled, not orphan-deleted)
- [ ] Check-fire order is merged/cleared, then PR-watch, then orphan-delete, then still-running judge
- [ ] Check fire + still-running is coordinator judgment; no look count auto-pings
- [ ] The PR-watch routine self-destructs on merge or cleared lease
- [ ] `tests/factory/coordinator-wake.test.ts` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

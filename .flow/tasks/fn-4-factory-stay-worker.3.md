---
satisfies: [R3, R6]
---
# fn-4-factory-stay-worker.3 Classify next job from git and phase prompts

## Description
Lock restart classification and named-job prompts (R3, R6). The ordered matrix already shipped in task 1. This task makes later-phase prompts and sidecar-status tests complete.

**Size:** M
**Files:** `skills/factory-coordinator/SKILL.md`, `tests/factory/coordinator-classify.test.ts`
**Touches:** [skills/factory-coordinator/**, tests/factory/coordinator-classify.test.ts]

### Approach
- Keep the task-1 matrix. Do not invent a second ordering.
- Restart reads the same git fields. After work-rolling finishes, next is spec-completion-review if that status is not done, even if a PR is already open. Do not launch impl-review because no `impl_review_status` exists.
- Later phases stay on the spec branch or PR head. Do not follow a generated cursor branch if one appeared.
- work-rolling is one agent. It reviews each finished task as it goes. A failed per-task review retries or asks inside that job. Never launch a standalone impl-review after work-rolling. A later review or CI problem is a CI/review fix agent.
- Each launch prompt names the flow-next skill for that job. Do not invoke land. Do not invent `/pilot`.
- Add `tests/factory/coordinator-classify.test.ts` locking: after work-rolling, completion-review is next; open PR cannot skip it; no standalone impl-review.

### Investigation targets
**Required** (read before coding):
- `skills/factory-coordinator/SKILL.md` — matrix and pickup from task 1
- `factory/lib/ready.ts:187-220` — gate classifies repo-level `pilot|land` only
- `factory/gate.ts:27-32` — `kind` on stdout is not the coordinator job

**Optional** (reference as needed):
- `.flow/specs/fn-4-factory-stay-worker.json` — example sidecar review-status fields

### Key context
- Compact a result back to the coordinator. Do not hand the coordinator a full transcript as the source of the next job.
## Acceptance
- [ ] Restart uses the task-1 matrix. After work-rolling, completion-review is next
- [ ] An open PR before completion-review is done classifies as completion-review, not merge
- [ ] A successful work-rolling is not followed by a standalone impl-review
- [ ] Later review or CI problems classify as a CI/review fix agent, not impl-review
- [ ] Prompts name the matching flow-next skill, use the spec or PR branch, and do not invoke land
- [ ] `tests/factory/coordinator-classify.test.ts` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

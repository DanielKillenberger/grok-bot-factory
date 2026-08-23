---
satisfies: [R8, R12, R13, R14]
---
# fn-1-grok-bot-factory.2 Isolated tick runner and host pin

## Description
Start-path after the gate: one worktree per tick, instance host CLI, product review pin, invoke `/loop` or `/goal` (R8, R12–R14). Split from the gate so isolation/pin work does not block the quiet-path proof.

**Size:** M
**Files:** `factory/tick.sh`, `factory/lib/worktree.sh`, `factory/lib/pin.sh`, `tests/factory/tick.test.sh`
**Touches:** [factory/tick.sh, factory/lib/worktree.sh, factory/lib/pin.sh, tests/factory/tick.test.sh]

## Approach
- Consume gate start output (`repo sha kind`). New worktree (or clone) per tick; never reuse another tick’s tree.
- Allocate a unique directory atomically under a factory worktree root; `realpath` must stay inside that root; refuse symlink escape. `git worktree add` at `after`. If ticks share a clone git dir, take a narrow per-repo lock around add/remove only. `remove`/`prune` in `finally`; do not force-remove dirty; do not remove another tick’s path.
- **Host CLI** from instance flag/env (documented host set). Probe that it can run `/loop` or `/goal`. Do not read the host binary from `.flow/config.json` and do not guess from `review.backend`. Missing or no `/loop`/`/goal` → exit 20. Default = CLI already on the builder machine. Cloud Agents only if that instance CLI cannot run (R14).
- **Review pin** from the product checkout: `.flow/config.json` `review.backend` + instruction-file routing. Do not overwrite. Unfulfillable review pin → exit 20.
- `kind=pilot`: instance host `/loop` or `/goal` repeating `/flow-next:pilot` until `NO_WORK` / `NEEDS_HUMAN` / `DEFERRED_TO_LAND`. `kind=land`: `/flow-next:land` tick. Product work stays in the host, not Grok Bot chat.
- Parallel ticks allowed. Claims skip work another actor holds (`flowctl start`). `git -c` author allowed. No force-push, no git config/remote edits.
- Per-tick id + local structured logs (repo, sha, kind, phase, host verdict, stuck reason, cleanup). Not progress pings.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-1-grok-bot-factory.md` — R8, R12–R14, Approach tick section
- `README.md:28-36` — current supervisor steps (replace hardcoded review pin with repo review pin + instance host CLI)
- `.flow/config.json` — `review.backend` is a review pin, not a host executable

**Optional** (reference as needed):
- `tests/factory/gate.test.sh` — start-output contract from task 1

## Key context
- flow-next claims live in the git common dir (shared across worktrees); working trees must still be unique.
- `git worktree add` refuses a branch already checked out elsewhere — unique branch/path per tick.
- Setup never overwrites an existing `review.backend` or `<!-- flow-next:model-routing -->` block. Factory must not either.
- Native Grok `host` review fails closed for a Grok writer; Grok Build is a valid host CLI (/loop and /goal). /loop is a recurring interval that wakes the agent, same idea as Claude Code.

## Acceptance
- [ ] Two overlapping starts get two worktrees; they do not share a working tree
- [ ] Concurrent allocation does not collide; symlink-escape paths are refused; cleanup does not remove another tick’s tree
- [ ] Host CLI comes from instance input and is probed for `/loop` or `/goal`; it is not inferred from `review.backend`
- [ ] Review backend is read from the product checkout and is not overwritten
- [ ] Missing host CLI, host without `/loop`/`/goal`, or unfulfillable review pin → stuck (exit 20), no guessed CLI
- [ ] Cloud Agents are not used when the instance host CLI is present and runnable
- [ ] Product work is invoked via `/loop` or `/goal` (or land), not implemented in chat
- [ ] Claims skip in-progress work held by another actor
- [ ] Per-tick local logs exist and are not sent as progress pings
- [ ] Tests use fake host/pin fixtures; no live Cloud Agent, no production wake
- [ ] `tests/factory/tick.test.sh` passes

## Done summary
Isolated per-tick worktree runner with instance host CLI probe (/loop or /goal) and product review pin (R8, R12–R14). Host/pin failures exit 20; NO_WORK is quiet; tests use fake host fixtures.

baseline: green (tests/factory/gate.test.sh)
stage: impl-review - ran [2026-08-23 NEEDS_WORK .. 2026-08-23T22:40:46Z SHIP]
stage: plan-sync - skipped(config: planSync.enabled != true)
## Evidence
- Commits: c9feddde063f553b31d28308668dc8101709ece2, ecb2e0016ca58b714527aae6be82f9b0dc048743, 267798f4d862e51b0e0f012762b0fd6fe0863b3f
- Tests: tests/factory/gate.test.sh, tests/factory/tick.test.sh
- PRs:
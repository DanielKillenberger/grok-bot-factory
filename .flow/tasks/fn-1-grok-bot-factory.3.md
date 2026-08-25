---
satisfies: [R1, R3, R9, R10, R15]
---
# fn-1-grok-bot-factory.3 Notify path, builder contract, README

## Description
Stuck/owner-gated notify (builder → main → human), builder-owns-routine contract, pre-model gate invocation, and README/CHANGELOG (R1, R3, R9, R10, R15). Finalization is this task, not a fourth docs task.

**Size:** M
**Files:** `factory/notify.sh`, `skills/factory-builder/SKILL.md`, `README.md`, `CHANGELOG.md`, `tests/factory/secrets.test.sh`, `tests/factory/notify.test.sh`
**Touches:** [factory/notify.sh, skills/factory-builder/SKILL.md, README.md, CHANGELOG.md, tests/factory/secrets.test.sh, tests/factory/notify.test.sh]

## Approach
- Coordinator: every gate or runner exit `20` becomes `NEEDS_HUMAN` with the stderr reason preserved. Also notify on `ASKED` and owner-gated send/pay/publish/merge (`DEFERRED_TO_LAND` included). Map dirty-tree / `BLOCKED` at tick start to `NEEDS_HUMAN`. Else quiet — no picked-up / still-running / PR-opened pings.
- Path: builder Grok Bot handoff to main; if main cannot resolve, human. Builder owns the webhook routine and runs the factory program; main is not the routine owner.
- Routine contract (R3): first action is exec of the gate program on the delivered body, no model. If the panel cannot exec a command before a model, do not ship a model-first quiet path — fail the proof instead of weakening R3. Non-production: document the command-first wiring; tests stub the coordinator (403 from gate, pin-failure from runner) through notify.
- README: keep copy-paste hand-wire (R1). Stop claiming the repo is runbook-only. Distinguish instance host CLI from the product review pin; drop hardcoded `cursor:gpt-5.6-sol-high` as the product default. Add vault paths to the do-not-git list. Keep don’t-arm. Do not invent payload wrapper fields or instance-config filenames.
- CHANGELOG: Added factory runtime. Guard: fail tests if routine URL, sender key, tokens, PATs, sessions, or vault paths appear in tracked files.

## Investigation targets
**Required** (read before coding):
- `README.md` — Queue, Wake, On fire, Notify, Do not put in git, Do not arm
- `.flow/specs/fn-1-grok-bot-factory.md` — R3, R9, R10, R15, Boundaries
- `factory/gate.sh` / tick exit contract — exit 20 → notify

**Optional** (reference as needed):
- `.flow/specs/fn-2-easy-install-setup.md` — leave easy-install pointer as “later”; do not implement fn-2 here

## Key context
- Grok Bot handoffs: https://docs.x.ai/grok-bot/chat-and-collaboration (async message; no public REST required).
- Manual wiring remains enough (R1). This task must not require fn-2.
- Model-first fallback was rejected in plan review.

## Acceptance
- [ ] Gate or runner exit 20 maps to `NEEDS_HUMAN` with reason; tests cover Contents-403 and missing host/pin
- [ ] Notify helper fires only for the R10 set (plus dirty-tree/`BLOCKED` → NEEDS_HUMAN); progress events stay quiet
- [ ] Builder skill owns the routine and execs the gate program as the first action with no model
- [ ] If command-before-model is impossible on the platform, the task fails closed rather than starting a model to run the gate
- [ ] Main is documented as the stuck hop only
- [ ] README still describes hand-wired GitHub push → routine; does not require easy-install
- [ ] README distinguishes instance host CLI from the product review pin; does not hardcode this instance’s review model as the product default
- [ ] CHANGELOG notes the runtime; don’t-arm remains
- [ ] `tests/factory/secrets.test.sh` fails if secrets/routine URL/sender key/vault paths are in git
- [ ] `tests/factory/notify.test.sh` passes
- [ ] No live routine or webhook is created as a side effect of this task

## Done summary
Notify helper maps gate/runner exit 20 to NEEDS_HUMAN (403 and missing host/pin covered), fires only the R10 set, and ships the builder command-first contract plus README/CHANGELOG/secrets guard. Already on this branch. `bun test` 147 pass. No new code this tick.

baseline: green
stage: impl-review - prior SHIP 2026-08-23
## Evidence
- Commits: 46897628cd7876635e9ce2a608160d627313a673, 191f5e669e5a78b8751f715935f3603eb091e914
- Tests: bun test (147 pass, 0 fail)
- PRs:
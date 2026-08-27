---
satisfies: [R6, R7]
---
# fn-3-easy-install-flow-next-onboard.2 README short beat and later-proof e2e

## Description
Match the README Easy-install section to the skill walkthrough and document same-account later-proof (R6, R7). CHANGELOG notes the walkthrough. Depends on the skill so the beats stay in lockstep.

**Size:** S
**Files:** `README.md`, `CHANGELOG.md`, `tests/factory/notify.test.ts`
**Touches:** [README.md, CHANGELOG.md, tests/factory/notify.test.ts]

### Approach
- Rewrite `## Easy-install` as a short-beat matching the skill: orient, find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action — not a lecture, not a recap novel.
- Keep Easy-install optional (`not required` / hand-wire remains). Do not replace Wake/hand-wire.
- Document the two later-proof e2e cases (not run now): no-builder (create a new builder + webhook; live teammates do not count) and existing-builder (reuse a designated test builder only; no third; never the live factory builder). Same-account: a second main on the same account, throwaway product repo, shared computer/GitHub, no second login. Never reuse live factory builder / live factory-wake webhook / live secrets; do not arm live factory-wake.
- CHANGELOG Unreleased notes the walkthrough (conversation-first; fire path unchanged).
- Extend `tests/factory/notify.test.ts` README contracts so they fail if Easy-install omits the six-beat order, omits per-beat why, or omits either R7 later-proof case / live-factory exclusions. Preserve existing contracts (`factory/gate.ts`, hand-wire, not required, instance host CLI, review pin, do not arm, no hardcoded review model pin).

### Investigation targets
**Required** (read before coding):
- `README.md:45-51` — current Easy-install paragraph
- `skills/easy-install/SKILL.md` — walkthrough beats from task 1
- `tests/factory/notify.test.ts:250-265` — existing README/CHANGELOG contracts to keep and extend
- `.flow/specs/fn-3-easy-install-flow-next-onboard.md` — R6, R7

**Optional** (reference as needed):
- `README.md:15-21` — Wake hand-wire that must remain
- `CHANGELOG.md` — Unreleased easy-install note to extend, not contradict

### Key context
- Later-proof is documentation only. Do not arm live factory-wake while implementing.
- Product-role language stays generic (owner / GitHub / builder / notify). No instance names. No secrets in git.

### Acceptance
## Acceptance
- [ ] README Easy-install is a short-beat matching the skill order (orient → find repos → you pick → builder/webhook → paste two secrets → done)
- [ ] Each README Easy-install beat has one short why, then the action
- [ ] Hand-wire Wake remains valid; easy-install stays optional / not required
- [ ] Both later-proof e2e cases are documented (no-builder create; existing-builder designated test builder only); live teammates are not an existing builder; no third builder; never the live factory builder / wake / secrets
- [ ] Same-account constraints documented: second main, throwaway product repo, shared computer/GitHub, no second login, do not arm live factory-wake
- [ ] CHANGELOG notes the walkthrough
- [ ] `tests/factory/notify.test.ts` document-contracts fail if README omits beat order, per-beat why, or R7 later-proof constraints, and still keep existing README contracts
- [ ] `bun test tests/factory/notify.test.ts` passes after the README rewrite
- [ ] No secrets, instance names, or live-arm instructions in git
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

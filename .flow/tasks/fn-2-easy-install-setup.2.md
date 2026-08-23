---
satisfies: [R1, R2, R3, R4, R6, R7]
---
# fn-2-easy-install-setup.2 Builder, routine, and push hooks

## Description
Mutate path after confirm: assign/create builder, webhook routine that runs fn-1, GitHub push hooks, pin-preserve, secrets/README (R1–R4, R6, R7). Depends on discover-then-confirm so hooks cannot precede confirm.

**Size:** M
**Files:** `factory/hooks.sh`, `skills/easy-install/SKILL.md`, `README.md`, `CHANGELOG.md`, `tests/factory/hooks.test.sh`, `tests/factory/secrets.test.sh`
**Touches:** [factory/hooks.sh, skills/easy-install/SKILL.md, README.md, CHANGELOG.md, tests/factory/hooks.test.sh, tests/factory/secrets.test.sh]

## Approach
- Input is **only** an explicit owner-confirmed `owner/name` list. Refuse an unconfirmed/candidate-list argument. Fixture: confirmed subset is the only set POSTed/PATCHed.
- Assign an existing builder by default; create one only if none exists (Grok Bot conversation/UI — no public REST). Re-run reuses builder + routine; do not create a second routine.
- After confirm: create `{ "type": "webhook" }` routine if missing. Wire it to fn-1’s builder contract: command-first exec of the gate program on the GitHub push body (no model), then coordinator/tick runner, passing the instance host-CLI input. Fail closed if routine URL + sender key cannot be obtained (owner paste from Routines panel is allowed). Stubbed proof that the routine’s first action is the gate, not a model.
- Converge GitHub hooks (paginate GET). Secret on GET is `********` — do not skip on URL match.
  - 0 matching URL → POST `name: web`, `events: ["push"]`, `content_type: json`, `insecure_ssl: "0"`, url=routine URL, secret=sender key, `active: true`.
  - 1 matching URL → PATCH complete desired config including the current secret, `active: true`, events exactly `["push"]`.
  - ≥2 matching URLs → fail/report that repo.
  - POST `422` → re-GET and converge.
- Do not overwrite a product repo’s flow-next:setup review pin (do not re-run setup to “refresh”; existing `review.backend` and routing block stay). Host CLI remains instance input (fn-1 R14).
- Partial failure: report succeeded/failed repos; no automatic rollback; retry is idempotent.
- README: add easy-install (send this repo to main) next to hand-wire. CHANGELOG. Secrets test must still fail on committed routine URL / sender key / tokens / PATs / sessions / vault paths. Do not arm live repos while implementing — tests stub GitHub + panel.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R2–R4, R6, R7, Approach
- `.flow/specs/fn-1-grok-bot-factory.md` — pre-model gate, coordinator, instance host CLI
- `skills/easy-install/SKILL.md` — confirm contract from task 1
- `README.md` — Wake / Add a repo / Do not put in git / Do not arm

**Optional** (reference as needed):
- `factory/discover.sh` — candidate ids are not hook input; confirmed list is
- `tests/factory/secrets.test.sh` — may already exist from fn-1.3; extend, don’t weaken

## Key context
- Create/update webhook: https://docs.github.com/en/rest/repos/webhooks — GET redacts secret; PATCH without secret clears it.
- No public Grok Bot agent/routine CRUD (https://docs.x.ai/grok-bot/skills-routines-and-automations). Conversational create only.
- flow-next setup leaves existing review pins (`kept (yours)`). Easy-install must not overwrite them.

## Acceptance
- [ ] `hooks.sh` accepts only an explicit confirmed repo list; unconfirmed input is refused
- [ ] Fixture: zero hook writes before confirm; after confirm, exactly the confirmed set
- [ ] Existing builder is assigned when one exists; a builder is created only when none exists
- [ ] Re-run does not mint a second webhook routine
- [ ] Routine first action is fn-1 gate command-first (body in, coordinator/tick after); stubbed proof, no model-first quiet path
- [ ] Instance host-CLI input is supplied to that wiring; review pin is not overwritten
- [ ] Unique URL match is PATCHed with current secret, `active: true`, push-only; no URL-only skip
- [ ] Duplicate URL matches are reported, not guessed; POST 422 re-GETs and converges
- [ ] Fail closed if routine URL or sender key is missing; they are never written to git
- [ ] Partial failure reports; no automatic rollback
- [ ] README documents send-to-main easy-install; hand-wire remains
- [ ] CHANGELOG notes easy-install
- [ ] Secrets test still fails on committed secrets/vault paths
- [ ] Tests stub GitHub; implementing this task does not arm live repos
- [ ] `tests/factory/hooks.test.sh` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

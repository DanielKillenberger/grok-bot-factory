---
satisfies: [R1, R2, R4, R6, R7]
---
# fn-2-easy-install-setup.2 Builder, routine, and push hooks

## Description
Mutate path after confirm: assign/create builder, webhook routine, GitHub push hooks, pin-preserve, secrets/README (R1, R2, R4, R6, R7). Depends on discover-then-confirm so hooks cannot precede confirm.

**Size:** M
**Files:** `factory/hooks.sh`, `skills/easy-install/SKILL.md`, `README.md`, `CHANGELOG.md`, `tests/factory/hooks.test.sh`, `tests/factory/secrets.test.sh`
**Touches:** [factory/hooks.sh, skills/easy-install/SKILL.md, README.md, CHANGELOG.md, tests/factory/hooks.test.sh, tests/factory/secrets.test.sh]

### Approach
- Assign an existing builder by default; create one only if none exists (Grok Bot conversation/UI — no public REST). Re-run reuses builder + routine; do not create a second routine.
- After confirm: create `{ "type": "webhook" }` routine if missing. Fail closed if routine URL + sender key cannot be obtained (owner paste from Routines panel is allowed).
- `POST /repos/{owner}/{repo}/hooks` with `name: web`, `events: ["push"]`, `content_type: json`, `insecure_ssl: "0"`, url=routine URL, secret=sender key. `GET …/hooks` first; skip equivalents. Never PATCH without re-sending `secret`.
- Do not overwrite a product repo’s flow-next:setup pin (do not re-run setup to “refresh”; existing `review.backend` and routing block stay).
- Partial failure: report succeeded/failed repos; no automatic rollback; retry is idempotent.
- README: add easy-install (send this repo to main) next to hand-wire. CHANGELOG. Secrets test must still fail on committed routine URL / sender key / tokens / PATs / sessions / vault paths. Do not arm live repos while implementing — tests stub GitHub + panel.

### Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R2, R4, R6, R7, Approach
- `skills/easy-install/SKILL.md` — confirm contract from task 1
- `README.md` — Wake / Add a repo / Do not put in git / Do not arm

**Optional** (reference as needed):
- `factory/discover.sh` — candidate ids to hook
- `tests/factory/secrets.test.sh` — may already exist from fn-1.3; extend, don’t weaken

### Key context
- Create webhook: https://docs.github.com/en/rest/repos/webhooks#create-a-repository-webhook
- No public Grok Bot agent/routine CRUD (https://docs.x.ai/grok-bot/skills-routines-and-automations). Conversational create only.
- flow-next setup leaves existing pins (`kept (yours)`). Easy-install must not overwrite them.

## Acceptance
- [ ] Existing builder is assigned when one exists; a builder is created only when none exists
- [ ] Re-run does not mint a second webhook routine
- [ ] Hooks are created only after confirm, push-only, content_type json
- [ ] Equivalent existing hooks are skipped (GET first)
- [ ] Fail closed if routine URL or sender key is missing; they are never written to git
- [ ] Product repo flow-next:setup pin is not overwritten
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

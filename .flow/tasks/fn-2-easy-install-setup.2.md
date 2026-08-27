---
satisfies: [R1, R2, R3, R4, R6, R7]
---
# fn-2-easy-install-setup.2 Builder, routine, and factory-forward Action

## Description
Mutate path after confirm: assign/create builder, one webhook routine that runs fn-1, converge the standing factory-forward GitHub Action plus two Actions secrets on the confirmed set (R1–R4, R6, R7). Depends on discover-then-confirm so install cannot precede confirm.

**Size:** M
**Files:** `factory/install.ts`, `skills/easy-install/SKILL.md`, `README.md`, `CHANGELOG.md`, `tests/factory/install.test.ts`, `tests/factory/stub-gh-install.ts`, `tests/factory/secrets.test.ts`
**Touches:** [factory/install.ts, skills/easy-install/SKILL.md, README.md, CHANGELOG.md, tests/factory/install.test.ts, tests/factory/stub-gh-install.ts, tests/factory/secrets.test.ts]

## Approach
- Input is **only** an explicit owner-confirmed `owner/name` list. Refuse an unconfirmed/candidate-list argument. Fixture: confirmed subset is the only set that receives Contents/secrets writes.
- Assign an existing builder by default; create one only if none exists (Grok Bot conversation/UI — no public REST). Re-run reuses builder + routine; do not create a second routine.
- After confirm: create `{ "type": "webhook" }` routine if missing. Wire it to fn-1’s builder contract: command-first exec of the gate program on a gate-valid GitHub push body (no model), then coordinator/tick runner, passing the instance host-CLI input. Fail closed if routine URL + sender key cannot be obtained (owner paste from Routines panel is allowed). Stubbed proof that the routine’s first action is the gate, not a model.
- Do **not** create Settings→Webhooks. Do **not** call `POST/PATCH /repos/{owner}/{repo}/hooks`. `factory/hooks.ts` is out.
- On confirm, converge the standing template `.github/workflows/factory-forward.yml` onto each confirmed repo (Contents API create-or-update; re-GET on SHA mismatch). Copy the template as-is (Bearer, User-Agent identity line, two secret names). One builder webhook routine for all Actions.
- Workflow secrets (never in git): `GROK_BOT_WEBHOOK_URL`, `GROK_BOT_SENDER_KEY`. Owner supplies both (paste). GitHub never returns secret values; setup cannot copy secrets repo-to-repo and cannot prove a GET match. Fail closed if either value is missing. Re-run may set again; existence of a secret *name* is not proof of the current value — do not skip a supplied set.
- Identity rides in the standing template: `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. Do not invent a different wake family.
- Do not overwrite a product repo’s flow-next:setup review pin (do not re-run setup to “refresh”; existing `review.backend` and routing block stay). Host CLI remains instance input (fn-1 R14).
- Partial failure: report succeeded/failed repos; no automatic rollback; retry is idempotent (converge Action file; secrets still owner-set).
- README: add easy-install (send this repo to main) next to hand-wire. Hand-wire remains and must describe the standing Action + two secrets (not Settings→Webhooks). CHANGELOG notes easy-install.
- Secrets test must still fail on committed routine URL / sender key / tokens / PATs / sessions / vault paths, and must still fail on Settings-hook REST URLs. Do not arm live repos while implementing — tests stub GitHub + panel.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R2–R4, R6, R7, Approach, API Contracts
- `.github/workflows/factory-forward.yml` — standing template to copy (Bearer, User-Agent, secret names)
- `.flow/specs/fn-1-grok-bot-factory.md` — pre-model gate, coordinator, instance host CLI
- `skills/easy-install/SKILL.md` — confirm contract from task 1
- `factory/lib/gh.ts` — `gh` wrapper to reuse for Contents + `gh secret set` / secret list
- `tests/factory/secrets.test.ts` — extend, don’t weaken

**Optional** (reference as needed):
- `factory/discover.ts` — candidate ids are not install input; confirmed list is
- `README.md` — Wake / Add a repo / Do not put in git / Do not arm
- `skills/factory-builder/SKILL.md` — gate-first routine already documented for the builder

## Key context
- Actions secrets: https://docs.github.com/en/rest/actions/secrets — GET never returns values; PUT needs the repo public key (or `gh secret set`).
- Contents API: https://docs.github.com/en/rest/repos/contents — PUT create/update; update requires the current sha.
- No public Grok Bot agent/routine CRUD (https://docs.x.ai/grok-bot/skills-routines-and-automations). Conversational create only.
- flow-next setup leaves existing review pins (`kept (yours)`). Easy-install must not overwrite them.
- Live fire path: the Action POSTs `GITHUB_EVENT_PATH` with `Authorization: Bearer`. Native Settings HMAC Secret is ignored by Cursor.

## Acceptance
- [ ] `install.ts` accepts only an explicit confirmed repo list; unconfirmed input is refused
- [ ] Fixture: zero Action/secret writes before confirm; after confirm, exactly the confirmed set
- [ ] Existing builder is assigned when one exists; a builder is created only when none exists
- [ ] Re-run does not mint a second webhook routine
- [ ] Routine first action is fn-1 gate command-first (body in, coordinator/tick after); stubbed proof, no model-first quiet path
- [ ] Instance host-CLI input is supplied to that wiring; review pin is not overwritten
- [ ] Each confirmed repo receives a converged `.github/workflows/factory-forward.yml` matching the standing template (create or update; SHA mismatch re-GETs)
- [ ] Owner-supplied `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` are set as Actions secrets; missing either fails closed; GET cannot prove values
- [ ] No Settings-hook REST; no `factory/hooks.ts`
- [ ] User-Agent identity line is present in the installed workflow (from the standing template)
- [ ] Partial failure reports; no automatic rollback
- [ ] README documents send-to-main easy-install; hand-wire remains and describes Action + secrets, not Settings→Webhooks
- [ ] CHANGELOG notes easy-install
- [ ] Secrets test still fails on committed secrets/vault paths and on Settings-hook REST
- [ ] Tests stub GitHub; implementing this task does not arm live repos
- [ ] `bun test tests/factory/install.test.ts` passes

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

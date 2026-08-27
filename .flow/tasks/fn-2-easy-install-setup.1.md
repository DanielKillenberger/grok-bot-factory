---
satisfies: [R1, R3, R5]
---
# fn-2-easy-install-setup.1 Discover-then-confirm membership

## Description
Conversational discovery for easy-install (R1, R3, R5): list `.flow/` candidates without clone, wait for confirm, ask on a named repo without `.flow/`. Split from Action install so confirm is proven before any mutate.

**Size:** M
**Files:** `factory/discover.ts`, `factory/lib/membership.ts`, `factory/lib/github_push.ts`, `skills/easy-install/SKILL.md`, `tests/factory/discover.test.ts`, `tests/factory/stub-gh-discover.ts`
**Touches:** [factory/discover.ts, factory/lib/membership.ts, factory/lib/github_push.ts, skills/easy-install/SKILL.md, tests/factory/discover.test.ts, tests/factory/stub-gh-discover.ts]

## Approach
- Reuse fn-1 single-repo `.flow/` probe. Listing is paginated `gh repo list` (do not stop at the 30-repo default) then one Contents call per candidate — never clone, never a frozen allowlist in this repo. Whitelist overlay via flag/env only.
- Fail closed with a visible error on 401/403/429/5xx, network, malformed output, or a mid-scan probe failure. Never hand the owner a silent partial list as “the candidates.” Treat a full page at the list cap as incomplete, not complete.
- Output a candidate list; do not install the factory-forward Action and do not create a routine. Confirm is required and lives in the easy-install skill (the conversation coordinator). The skill waits for the confirmation reply and only then invokes `factory/install.ts` with that named subset. Conversation-only must still work (R1); a confirm card may appear.
- Named repo with no `.flow/`: ask whether they intended it and whether to init flow-next. No auto-init, no silent skip.
- Match this repo’s TypeScript/Bun factory (not a new shell program). Reuse `factory/lib/args.ts`, `factory/lib/gh.ts`, `factory/lib/exit.ts`. Export the owner/name check already used by `factory/lib/github_push.ts` (do not duplicate the private regex) and call that export from discover.
- Fixture tests with stub `gh`: named no-`.flow/` repo; more than 30 repos; 401/403/429/5xx; network; malformed output; mid-scan failure; pagination exhausted at cap. Integration fixture: the skill/orchestrator does not invoke install before the confirmation reply (zero Contents PUT, zero `gh secret set`, zero Settings-hook REST). Do not call live GitHub mutate APIs.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R3, R5, Approach, Early proof point
- `factory/lib/membership.ts` — fn-1 single-repo `.flow/` probe (fire path currently requires a push SHA; discover needs a default-ref probe)
- `factory/lib/github_push.ts` — owner/name regex already used on the wake path (export it)
- `factory/lib/gh.ts` — `gh` wrapper + 429 retry / class mapping
- `tests/factory/stub-gh.ts` — existing stub `gh`; fire-path stub forbids fleet-scan (`repo list`)

**Optional** (reference as needed):
- `factory/lib/args.ts`, `factory/lib/exit.ts` — flag parse and 0/10/20 exits
- `README.md` — Add a repo (hand-wire remains valid; this task does not rewrite README)
- `tests/factory/helpers.ts` — `runBun`, `linkStub`, `ROOT`

## Key context
- `gh repo list` default limit is 30 — paginate. Contents 404 = no `.flow/`. Do not treat 403 as absent.
- This spec depends on fn-1; do not reimplement the gate.
- Native Settings→Webhooks are not the fire path. Discover must not POST `/repos/{owner}/{repo}/hooks`.
- Confirmation is the skill’s job, not a flag name on the mutate program. Discover stdout is not install input.
- Proof runner in this repo is `bun test`. A thin `.sh` wrapper that only execs the bun test is optional.

## Acceptance
- [ ] Discovery lists candidates via `gh` without cloning and paginates past the 30-repo default
- [ ] Incomplete discovery (401/403/429/5xx, network, malformed, mid-scan, pagination cap) fails closed with a visible error; no confirmable partial list
- [ ] Named repo without `.flow/` prompts intent + init; does not auto-init or skip
- [ ] Skill/orchestrator does not invoke Action install, secret writes, or routine create until an owner confirmation reply; fixture shows zero mutate REST before confirm
- [ ] Discover stdout / candidate list is not passed to `factory/install.ts`
- [ ] Owner/name validation is the exported helper from `factory/lib/github_push.ts`, not a copied private regex
- [ ] No hardcoded allowlist in the public repo; whitelist only as instance overlay
- [ ] Easy-install skill is a conversation with main, not a clicks-only UI
- [ ] `bun test tests/factory/discover.test.ts` passes
- [ ] Tests do not arm live repos
- [ ] No Settings-hook REST (`POST/PATCH /repos/{owner}/{repo}/hooks`) on this path

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

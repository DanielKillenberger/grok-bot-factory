---
satisfies: [R1, R3, R5]
---
# fn-2-easy-install-setup.1 Discover-then-confirm membership

## Description
Conversational discovery for easy-install (R1, R3, R5): list `.flow/` candidates without clone, wait for confirm, ask on a named repo without `.flow/`. Split from hook creation so confirm is proven before any mutate.

**Size:** M
**Files:** `factory/discover.sh`, `skills/easy-install/SKILL.md`, `tests/factory/discover.test.sh`
**Touches:** [factory/discover.sh, skills/easy-install/SKILL.md, tests/factory/discover.test.sh]

## Approach
- Reuse fn-1 single-repo `.flow/` probe (`factory/lib/membership.sh` / Contents / `gh repo read-dir`). Listing is paginated `gh repo list` (do not stop at the 30-repo default) then one Contents call per candidate — never clone, never a frozen allowlist in this repo. Whitelist overlay via flag/env only.
- Fail closed with a visible error on 401/403/429/5xx, network, malformed output, or a mid-scan probe failure. Never hand the owner a silent partial list as “the candidates.”
- Output a candidate list; do not create hooks. Confirm is required. The skill waits for the confirmation reply. The mutate program (`factory/hooks.sh`) is specified to accept **only** that confirmed `owner/name` list — this task owns the skill-side rule that hooks are not invoked before that reply. Conversation-only must still work (R1); a confirm card may appear.
- Named repo with no `.flow/`: ask whether they intended it and whether to init flow-next. No auto-init, no silent skip.
- Fixture tests with stub `gh`: named no-`.flow/` repo; more than 30 repos; 401/403/429/5xx; network; malformed output; mid-scan failure. Integration fixture: zero hook POSTs before confirmation. Do not call live hook APIs.

## Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R3, R5, Approach
- `factory/lib/membership.sh` — fn-1 single-repo `.flow/` probe (landed by fn-1.1)
- `README.md` — Add a repo (hand-wire remains valid)

**Optional** (reference as needed):
- `.flow/specs/fn-1-grok-bot-factory.md` — fire path vs discovery path

## Key context
- `gh repo list` default limit is 30 — paginate. Contents 404 = no `.flow/`. Do not treat 403 as absent.
- This spec depends on fn-1; do not reimplement the gate.

## Acceptance
- [ ] Discovery lists candidates via `gh` without cloning and paginates past the 30-repo default
- [ ] Incomplete discovery (401/403/429/5xx, network, malformed, mid-scan) fails closed with a visible error; no confirmable partial list
- [ ] Named repo without `.flow/` prompts intent + init; does not auto-init or skip
- [ ] Skill does not invoke hook create until an owner confirmation reply; fixture shows zero POSTs before confirm
- [ ] No hardcoded allowlist in the public repo; whitelist only as instance overlay
- [ ] Easy-install skill is a conversation with main, not a clicks-only UI
- [ ] `tests/factory/discover.test.sh` passes
- [ ] Tests do not arm live repos

## Done summary
Discover-then-confirm membership: paginated `gh repo list` plus the fn-1 `.flow/` contents probe, fail-closed incomplete scans, named repos without `.flow/` reported for the main-agent ask, easy-install skill waits for an explicit confirm before any hook mutate.

Whitelist overlay is flag/env only. Canonical `owner/name` validation is shared with push identity parsing.

stage: impl-review - ran [2026-08-26T20:38:46Z..2026-08-26T20:44:30Z] (model: gpt-5.6-sol-high)
stage: plan-sync - skipped(config: planSync.enabled != true)
## Evidence
- Commits: 8cac845239721f6aeebeeec9a4f5cd6350d72184, ea2043ce40896cb51a3b36f13becc3638f60112d, 9d325def79b5057ffce503ff5aef9f2b984aa42c
- Tests: bun test, tests/factory/discover.test.sh
- PRs:
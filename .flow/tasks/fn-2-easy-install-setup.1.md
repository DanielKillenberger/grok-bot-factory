---
satisfies: [R1, R3, R5]
---
# fn-2-easy-install-setup.1 Discover-then-confirm membership

## Description
Conversational discovery for easy-install (R1, R3, R5): list `.flow/` candidates without clone, wait for confirm, ask on a named repo without `.flow/`. Split from hook creation so confirm is proven before any mutate.

**Size:** M
**Files:** `factory/discover.sh`, `skills/easy-install/SKILL.md`, `tests/factory/discover.test.sh`
**Touches:** [factory/discover.sh, skills/easy-install/SKILL.md, tests/factory/discover.test.sh]

### Approach
- Reuse fn-1 single-repo `.flow/` probe (`factory/lib/membership.sh` / Contents / `gh repo read-dir`). Listing is `gh repo list` then one Contents call per candidate — never clone, never a frozen allowlist in this repo. Whitelist overlay via flag/env only.
- Output a candidate list; do not create hooks. Confirm is required (skill: wait). A confirm card may appear; conversation-only must still work (R1).
- Named repo with no `.flow/`: ask whether they intended it and whether to init flow-next. No auto-init, no silent skip.
- Fixture tests with stub `gh` (including a named no-`.flow/` repo). Do not call live hook APIs.

### Investigation targets
**Required** (read before coding):
- `.flow/specs/fn-2-easy-install-setup.md` — R3, R5, Approach
- `factory/lib/membership.sh` — fn-1 single-repo `.flow/` probe (landed by fn-1.1)
- `README.md` — Add a repo (hand-wire remains valid)

**Optional** (reference as needed):
- `.flow/specs/fn-1-grok-bot-factory.md` — fire path vs discovery path

### Key context
- `gh repo list` + Contents 404 = no `.flow/`. Do not treat 403 as absent.
- This spec depends on fn-1; do not reimplement the gate.

## Acceptance
- [ ] Discovery lists candidates via `gh` without cloning
- [ ] No hook create runs in this task
- [ ] Named repo without `.flow/` prompts intent + init; does not auto-init or skip
- [ ] No hardcoded allowlist in the public repo; whitelist only as instance overlay
- [ ] Easy-install skill is a conversation with main, not a clicks-only UI
- [ ] `tests/factory/discover.test.sh` passes
- [ ] Tests do not arm live repos

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

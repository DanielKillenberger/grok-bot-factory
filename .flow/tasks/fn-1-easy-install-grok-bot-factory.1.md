---
satisfies: [R4, R5, R6]
---
# fn-1-easy-install-grok-bot-factory.1 Deterministic pre-tick gate (no model tokens)

## Description
**Size:** M
**Files:** scripts/could-tick, tests that exercise the gate
**Touches:** [scripts/could-tick]

### Approach
Ship a deterministic script that answers whether a tick could actually run (pilot or land). This script is the first thing the factory runs. It must not call a model, a bot, or a chat API.

- Yes: at least one flow-next ready spec or ready task exists such that `/loop` or `/goal` (pilot tick) or land could do work.
- No: stay quiet. Exit without starting a harness, a bot, or a notify.

Readiness is flow-next `ready` only. Drafts and open-not-ready specs do not count. The script does not promote.

Do not invent a phone-home check. Do not arm a webhook. Do not implement a model loop here.

### Acceptance
- [ ] Script answers yes/no without invoking a model or bot
- [ ] No ready work → no → zero model tokens, no ping
- [ ] Ready work that could run a pilot or land tick → yes
- [ ] Draft/not-ready work is ignored
- [ ] A harness/model start before this script answers is treated as a defect in tests/docs

## Acceptance
- [ ] Deterministic yes/no gate exists and runs before any bot/model
- [ ] No-path is quiet and burns no model tokens
- [ ] Yes-path is only permission to start the harness (does not implement)
- [ ] Drafts are not treated as ready


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

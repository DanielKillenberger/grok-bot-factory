---
satisfies: [R18, R19]
---
# fn-1-easy-install-grok-bot-factory.5 Clawniel notify only on NEEDS_HUMAN / ASKED / owner-gated merge

## Description
**Size:** S
**Files:** scripts/notify-clawniel
**Touches:** [scripts/notify-clawniel]

### Approach
Notify Clawniel only when the outcome is `NEEDS_HUMAN`, `ASKED`, or an owner-gated merge (send, pay, publish, merge).

Else ship quiet. No "picked up", no "still running", no "PR opened".

Do not invent other notify channels. Do not phone-home.

### Acceptance
- [ ] Those three classes notify Clawniel
- [ ] All other outcomes are quiet
- [ ] No picked-up / still-running / PR-opened pings

## Acceptance
- [ ] Clawniel only on NEEDS_HUMAN / ASKED / owner-gated merge
- [ ] Else quiet


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

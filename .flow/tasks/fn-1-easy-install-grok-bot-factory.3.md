---
satisfies: [R11, R12, R15]
---
# fn-1-easy-install-grok-bot-factory.3 Supervisor pickup: ready-only, start /loop or /goal

## Description
**Size:** M
**Files:** scripts/supervise, supervisor runbook
**Touches:** [scripts/supervise]

### Approach
Grok Bot is the supervisor only. It notices ready specs/tasks and picks up. It is not the tick. It does not implement. It does not promote.

On gate yes: start `/loop` or `/goal` on a checkout. `/flow-next:pilot` is one tick inside that host.

On gate no: stop. No status ping.

Implement in Grok Bot chat is forbidden. Building happens in the host + grok + cursor-agent.

No new bot. No Homeplane. No phone-home.

### Acceptance
- [ ] Supervisor starts `/loop` or `/goal` only after gate yes
- [ ] Supervisor does not implement and is not the tick
- [ ] Drafts are not picked up
- [ ] No implement-in-Grok-Bot-chat path

## Acceptance
- [ ] Ready-only pickup
- [ ] Host is `/loop` or `/goal`; pilot is one tick
- [ ] No implement in Grok Bot chat


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

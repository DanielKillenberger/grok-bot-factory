---
satisfies: [R7, R8, R9, R10]
---
# fn-1-easy-install-grok-bot-factory.4 Harness pin: grok-build + cursor-agent gpt-5.6-sol-high

## Description
**Size:** M
**Files:** scripts/start-harness, factory review-pin notes
**Touches:** [scripts/start-harness]

### Approach
When the harness starts:

- Main flow-next session may run in grok-build.
- Review backend is cursor-agent `gpt-5.6-sol-high` (this repo already pins `.flow/config.json` `review.backend` to `cursor:gpt-5.6-sol-high`).
- Never bare `agent`.
- Never both local and cloud for the same role in one run.

Do not add a second reviewer family. Do not default to Cloud Agents when CLIs can run. Cloud Agents only if CLIs cannot — and then still one implementer (grok-4.6) and one reviewer (gpt-5.6-sol), never mixed local+cloud.

### Acceptance
- [ ] Start path can run the main session in grok-build
- [ ] Review pin is cursor-agent gpt-5.6-sol-high
- [ ] Bare `agent` is refused
- [ ] Local+cloud same-role is refused

## Acceptance
- [ ] grok-build allowed for main session
- [ ] Review is cursor:gpt-5.6-sol-high
- [ ] Bare agent forbidden
- [ ] Local+cloud same role forbidden


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

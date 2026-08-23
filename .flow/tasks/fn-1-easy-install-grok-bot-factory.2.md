---
satisfies: [R2, R3, R20]
---
# fn-1-easy-install-grok-bot-factory.2 Configurable repo-set discovery (no frozen allowlist)

## Description
**Size:** M
**Files:** scripts/discover-repos, repo-set contract docs
**Touches:** [scripts/discover-repos]

### Approach
Wake is push notify. Spec the wake; do not arm it. Do not create the Grok Bot webhook routine. Do not write a routine URL or sender key.

Repo set is configurable. Default membership: every DanielKillenberger repo that has `.flow` inited. A repo that later inits `.flow` becomes eligible without editing a checked-in name list.

A frozen allowlist of repo names is a defect. Discovery or configuration that can grow is required.

Webhook URL/key stay out of git (R13/R20). This task documents the wake contract only.

### Acceptance
- [ ] Default set = DanielKillenberger repos with `.flow` inited
- [ ] No checked-in frozen allowlist
- [ ] Wake is specified as push notify
- [ ] No webhook routine created; no URL/key written

## Acceptance
- [ ] Configurable repo set with discovery default (DanielKillenberger + `.flow`)
- [ ] No frozen allowlist
- [ ] Wake specified, not armed


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

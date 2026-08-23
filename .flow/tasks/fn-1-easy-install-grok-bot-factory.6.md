---
satisfies: [R1, R13, R14, R16, R17, R21]
---
# fn-1-easy-install-grok-bot-factory.6 Easy install + public-repo hygiene; README stays sketch

## Description
**Size:** M
**Files:** install notes next to the existing README, secret/hygiene ignore rules
**Touches:** [README.md]

### Approach
Make the factory easy to install. It is installed software plus the existing Grok Bot supervisor — not an app, dashboard, always-on server, new bot, Homeplane, or phone-home product.

The existing README stays as the intent sketch. Do not delete it. Do not replace it as the spec of record (fn-1 is the spec).

Public-repo hygiene: no webhook URL/key, no vault paths, no PATs, no tokens, no sessions in git.

No new bot. No Homeplane. No phone-home.

### Acceptance
- [ ] Install path exists and does not require a new bot or server product
- [ ] README still present as intent sketch
- [ ] No secrets/webhook URL/key/vault/PAT in the repo
- [ ] No Homeplane, no phone-home, no new bot

## Acceptance
- [ ] Easy-to-install factory (not app/dashboard/server/new-bot)
- [ ] README remains intent sketch
- [ ] No secrets in the public repo
- [ ] No phone-home / Homeplane / new bot


## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

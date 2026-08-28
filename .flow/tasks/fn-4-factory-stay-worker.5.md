---
satisfies: [R9]
---
# fn-4-factory-stay-worker.5 Advertise coordinator start and retarget install tests

## Description
Retarget advertised start and the install/test strings that still lock the old tick runner (R9). Builder handoff already changed in the first task.

**Size:** M
**Files:** `README.md`, `skills/easy-install/SKILL.md`, `CHANGELOG.md`, `factory/install.ts`, `tests/factory/install.test.ts`, `tests/factory/notify.test.ts`
**Touches:** [README.md, skills/easy-install/SKILL.md, CHANGELOG.md, factory/install.ts, tests/factory/install.test.ts, tests/factory/notify.test.ts]

### Approach
- README and easy-install say start is enable the coordinator skill, which launches Cloud Agents. Gate-first stays.
- Do not advertise `factory/tick.ts`. Do not document both starts.
- Auth is the Grok Bot native Cloud Agent capability (team toggle that Bots can launch Cursor cloud agents). Easy-install says to confirm that toggle is on. It does not paste a Cloud Agent API key. Coordinator preflight already pings if launch is impossible.
- Change `ROUTINE_COORDINATOR` in `factory/install.ts` to the coordinator-skill start. Update `tests/factory/install.test.ts`.
- Update the README `instance host cli` lock in `tests/factory/notify.test.ts` if that phrase leaves the advertised start.
- One Unreleased CHANGELOG beat.

### Investigation targets
**Required** (read before coding):
- `README.md:23-35` and `README.md:54-56` — advertised tick start
- `skills/easy-install/SKILL.md:85-119` — §4 tick runner and §6 done beat
- `factory/install.ts:18-30` — `ROUTINE_COORDINATOR` in the install report
- `tests/factory/install.test.ts:132` — locks `bun factory/tick.ts`
- `tests/factory/notify.test.ts:279` — locks README `instance host cli`

**Optional** (reference as needed):
- `CHANGELOG.md` Unreleased
- `skills/factory-builder/SKILL.md` — already retargeted by the first task

### Key context
- Do not rewrite fn-1 / fn-2 / fn-3 spec product text.

### Acceptance
- [ ] README and easy-install advertise coordinator skill → Cloud Agents, not `factory/tick.ts`
- [ ] Easy-install confirms the native Bot Cloud Agent capability and does not paste a new API secret
- [ ] Install report coordinator string matches the new start
- [ ] Factory tests that locked the old start are retargeted and `bun test tests/factory/` passes
- [ ] CHANGELOG Unreleased records the start change
## Acceptance
- [ ] README and easy-install advertise coordinator skill → Cloud Agents, not `factory/tick.ts`
- [ ] Easy-install confirms the native Bot Cloud Agent capability and does not paste a new API secret
- [ ] Install report coordinator string matches the new start
- [ ] Factory tests that locked the old start are retargeted and `bun test tests/factory/` passes
- [ ] CHANGELOG Unreleased records the start change
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

---
satisfies: [R1, R2, R3, R4, R5, R6]
---
# fn-3-easy-install-flow-next-onboard.1 Short-beat easy-install skill walkthrough

## Description
Rewrite the easy-install skill as the six-beat walkthrough (R1–R5, skill half of R6). Split from README so the conversation shape is proven before docs match it.

**Size:** M
**Files:** `skills/easy-install/SKILL.md`, `tests/factory/discover.test.ts`
**Touches:** [skills/easy-install/SKILL.md, tests/factory/discover.test.ts]

### Approach
- Restructure `skills/easy-install/SKILL.md` from discover-first into beats in this order: Orient → Find repos → You pick → Builder/webhook → Paste two secrets → Done.
- Frontmatter `description` must not imply discover is the first step.
- Every beat: one short why, then the action. Pause only at the owner decisions in spec Architecture. No lecture opening, no recap novel.
- Orient: one short why (this factory only works with flow-next / `.flow/` specs), then wait for understand-confirm. Do not run discover yet.
- No-confirm: do not run fleet `bun factory/discover.ts`. Ask where to apply and whether to install flow-next (`/flow-next:setup`). Never auto-init.
- When they name a repo on the no-confirm (or empty-list) path, run targeted existing discover only:
  `bun factory/discover.ts --named owner/name --whitelist owner/name`
  Bare `--named` still fleet-scans — do not use it alone here. `--whitelist` is the existing overlay used as a one-shot named constraint, not a frozen repo allowlist.
- Targeted result: name in `candidates` → you-pick that one-name set, wait for explicit confirm, then `bun factory/install.ts --confirmed` for names in that `candidates` list only. Name in `named_without_flow` → ask intent + `/flow-next:setup`; never auto-init; do not install; re-run the same targeted discover after setup until it is in `candidates`.
- Understand-confirm: fleet `bun factory/discover.ts`, then named-without-flow ask, explicit confirm of the set, builder/routine, owner-paste secrets, install on the confirmed subset of `candidates`.
- Extend `tests/factory/discover.test.ts` skill-string contracts so they fail on the current discover-first skill: beat order, one short why then action per beat, orient before any discover invocation, no-confirm uses `--named` and `--whitelist` together and does not invoke unconstrained discover, no install of a non-`candidates` name.
- Keep existing fn-2 fixture phrases (confirm reply, install after confirm, `--confirmed`, Do not auto-init, conversation not clicks-only, no allowlist, Do not overwrite, no Settings-hook paths).
- Default: do not change `factory/discover.ts`, `factory/install.ts`, `skills/factory-builder/SKILL.md`, or fn-1 runtime.
- Generic owner / GitHub / builder / notify language. No instance names. No secrets in git.

### Investigation targets
**Required** (read before coding):
- `skills/easy-install/SKILL.md` — current discover-first conversation to reshape
- `tests/factory/discover.test.ts:164-180` — required existing skill phrases to keep
- `factory/discover.ts:73-112` — `--named` still fleet-lists; `--whitelist` constrains scan
- `.flow/specs/fn-3-easy-install-flow-next-onboard.md` — R1–R5, Approach targeted-discover contract

**Optional** (reference as needed):
- `tests/factory/install.test.ts:221-227` — install-after-confirm phrases to keep
- `factory/install.ts` — confirm-then-install boundary; does not verify `.flow/`
- `.flow/specs/fn-2-easy-install-setup.md` — done fire path (do not reopen)

### Key context
- Stubbed `bun test` does not prove live conversation; document-contract tests still must fail if the new UX is missing.
- Discover stdout is JSON `{ candidates, named_without_flow }`. Exit 20 is fail-closed — show stderr and stop.
- Confirmation is the skill’s job, not a flag on install.

### Acceptance
## Acceptance
- [ ] Skill encodes beats in order: orient, find repos, you pick, builder/webhook, paste two secrets, done
- [ ] Each of those six beats has one short why, then the action (headings-plus-commands-only fails)
- [ ] Orient precedes any discover invocation; frontmatter does not start at discover
- [ ] No-confirm path does not fleet-discover; asks where to apply / whether `/flow-next:setup`; never auto-init
- [ ] Named repo on no-confirm/empty-list uses `bun factory/discover.ts --named owner/name --whitelist owner/name` (both flags); bare `--named` alone is not this handoff
- [ ] Install only names targeted discover returned in `candidates`; `named_without_flow` asks and does not install; never auto-init or silent skip
- [ ] After understand-confirm, remaining beats use fleet discover + confirm-then-install (`bun factory/install.ts --confirmed`)
- [ ] Pause only at owner decisions; no lecture opening or recap novel
- [ ] `tests/factory/discover.test.ts` document-contracts fail on the current discover-first skill (orient-before-discover, targeted no-confirm, why-then-action, beat order) and still keep fn-2 fixture phrases
- [ ] `bun test tests/factory/discover.test.ts tests/factory/install.test.ts` passes after the skill rewrite
- [ ] Discover/install/factory-builder sources unchanged unless a beat was inexpressible (default: unchanged)
- [ ] No secrets in git; no Settings-hook REST; no `factory/hooks.ts`
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

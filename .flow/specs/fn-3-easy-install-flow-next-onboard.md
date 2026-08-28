# Easy-install flow-next onboard

## Conversation Evidence

> user (turn 1): "Easy-install currently reads as if the owner already knows flow-next (`.flow/`, `/flow-next:setup`, fn-1 ticks, review pins)."

> user (turn 2): "First step of easy-install: make sure the owner knows this factory only works with flow-next (product repos that have flow-next / `.flow/` specs)."

> user (turn 3): "If they confirm they understand: then discover flow-next repos (existing `bun factory/discover.ts`) and continue the existing confirm-then-install Action path."

> user (turn 4): "If they do not understand / do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init."

> user (turn 5): "After that, the rest of easy-install stays: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks."

> user (turn 6): "Skill + maybe a short README beat. Program changes only if needed (discover can stay; the new branch is conversation-first)."

> user (turn 7): "Ready is owner confirmation later. This capture is draft / not ready."

> user (turn 8): "Keep generic: owner / GitHub / builder / notify. No personal names. No secrets in git."

> user (turn 9): "Do not reopen fn-2-easy-install-setup; that is status=done. This is a new spec."

> user (turn 10): "Named repo without `.flow/`: ask intent and whether to init flow-next. No auto-init, no silent skip."

> user (turn 11): "One builder webhook for all Actions. Do not mint a second routine."

> user (turn 12): "Factory runtime is fn-1 (already shipping). This spec does not reopen those."

> user (turn 13): "Program tests stay stubbed bun test. They do not prove conversation or install."

> user (turn 14): "Same-account test env (no second login): a second main on the same account. Never reuse the live factory builder or the live factory-wake webhook or live secrets."

> user (turn 15): "Two e2e cases (documented, not run in this spec): (a) no builder — create a new builder + webhook; live teammates do not count as an existing builder; (b) existing builder — reuse a designated test builder only, do not create a third, never the live factory builder."

> user (turn 16): "Throwaway product repo only. Do not arm live factory-wake. Shared computer/GitHub is expected."

> user (turn 17): "Live same-account e2e is AFTER the skill ships, not this spec's implement now."

> user (turn 18): "Do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git."

> user (turn 19): "can we reshape th fn-3 spec to not just fix this wrong assumption but also make the UX really nice for the end user with a easy to understand walk through flow that explains enought but doesn't over explain. Just nice and smooth."

> user (turn 20): "Whole setup as short beats"

> user (turn 20, confirmed option): orient (this factory only works with flow-next), find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action. Pause only when you need to decide. No lecture at the start, no recap novel at the end.

> user (turn 21): "After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. This belongs in the easy-install skill AND the short README beat (install instructions), not only John's wake prompt."

## Overview

Easy-install currently starts at discover, as if the owner already knows flow-next. This spec reshapes the **conversation** into a short-beat walkthrough of the whole setup: orient, find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action. Pause only at owner decisions.

Install mechanics stay the fn-2 fire path. Discover can stay. The deliverable is the easy-install skill plus a short README beat. Program changes only if a beat cannot be expressed in the skill. The skill and that short README beat (install instructions) also document: after every factory tick, if the tree moved, commit (if needed) and push to the spec branch; ADVANCED with a dirty or unpushed tree is a fail, not quiet success — not only the wake prompt. [user]

Depends on `fn-2-easy-install-setup` (done). Does not reopen fn-1 factory runtime.

## Goal & Context
<!-- scope: business -->

Easy-install currently reads as if the owner already knows flow-next (`.flow/`, `/flow-next:setup`, fn-1 ticks, review pins). [user]

Fixing that assumption is not enough. The whole setup conversation should be an easy walkthrough: enough explanation, not over-explanation; nice and smooth. [user]

Target user: the owner. Product-role language stays generic: owner / GitHub / builder / notify. Instance names stay out of the spec file. [user]

The walkthrough is the whole setup, as short beats: orient (this factory only works with flow-next), find repos, you pick, builder/webhook, paste two secrets, done. [user]

Each beat is one short why, then the action. Pause only when the owner needs to decide. No lecture at the start, no recap novel at the end. [user]

If they confirm they understand: run existing discover, then the existing confirm-then-install path. If they do not confirm: do not silently discover; ask where they want to apply the factory, and whether to install flow-next there (`/flow-next:setup`). Never auto-init. [user]

Why now: the fire path already ships on fn-2-easy-install-setup (status=done) — confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. That path is not this spec's work. This spec owns the conversation around it. [user]

Deliverable is the skill plus a short README beat. Discover program can stay. Program changes only if needed. [user]

Program tests stay stubbed bun test. They do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Two e2e cases are documented later-proof to run AFTER the skill ships, not this spec's implement now. [user]

After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. This belongs in the easy-install skill and the short README beat (install instructions), not only the wake prompt. [user]

## Approach

Conversation-first. Rewrite the easy-install skill as six short beats; keep the discover and install programs unless a beat is inexpressible in the skill (expected: no program change).

1. **Orient** — one short why: this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). Wait for understand-confirm. Do not run discover yet. Do not lecture.
2. **Find repos** — only after understand-confirm: existing `bun factory/discover.ts`. Exit 20 is fail-closed; show stderr and stop.
3. **You pick** — present candidates; wait for an explicit confirmation reply naming the set. `named_without_flow`: ask intent and whether to init (`/flow-next:setup`). Never auto-init, never silent skip.
4. **Builder/webhook** — assign an existing builder; create one only if none exists. One webhook routine for all Actions; do not mint a second.
5. **Paste two secrets** — owner pastes `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` from the routine panel, then existing `bun factory/install.ts --confirmed …` on the confirmed set. Not Settings hooks. Not copied between repos.
6. **Done** — a short close, not a recap.

No-confirm at orient: do not run fleet find-repos (`bun factory/discover.ts` with no name constraint). Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Never auto-init.

When they name a repo, run a **targeted** existing discover — not a fleet scan:

```bash
bun factory/discover.ts --named owner/name --whitelist owner/name
```

`--whitelist` is the existing instance overlay used here as a one-shot named constraint (no `gh repo list`). `--named` still reports the name in `named_without_flow` when `.flow/` is absent. This is not a frozen allowlist in the repo. Bare `--named` still fleet-scans; do not use it alone on this branch.

Then:
- Name is in `candidates`: present that one-name set at you-pick; wait for explicit confirm; only then `bun factory/install.ts --confirmed` for names in this `candidates` list.
- Name is in `named_without_flow`: ask intent and whether to init (`/flow-next:setup`). Never auto-init. Do not install. If they later finish setup, re-run the same targeted discover until the name is in `candidates`.
- Exit 20: show stderr and stop.

`install.ts` does not verify `.flow/`. The skill must not install a name that targeted discover did not return in `candidates`. Fleet discover is only the understand-confirm find-repos beat.

Empty candidate list after fleet discover: show it; wait for a named repo or stop. Do not invent a set. A later named repo on that empty-list path uses the same targeted discover as no-confirm.

README Easy-install becomes a matching short-beat (hand-wire Wake stays). CHANGELOG notes the walkthrough. Later-proof e2e (R7) is documented there, not run.

Extend skill/README **document-contract** tests (string fixtures). They do not prove live conversation or install. They must fail on the current discover-first skill and on a README that omits the beats or R7 constraints. Keep existing fn-2 fixture phrases.

## Architecture & Data Models
<!-- scope: technical -->

Easy-install's conversation is a short-beat walkthrough, not a silent program and not a lecture. [user]

Beats, in order:

1. Orient — this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). One short why, then wait for confirm they understand. [user]
2. Find repos — existing discover program. [user]
3. You pick — present candidates; wait for an explicit confirmation naming the set. Named repo without `.flow/`: ask intent and whether to init flow-next (`/flow-next:setup`). Never auto-init, never silent skip. [user]
4. Builder/webhook — assign an existing builder; create one only if none exists. One webhook routine for all Actions; do not mint a second. [user]
5. Paste two secrets — owner pastes workflow secrets `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` from the routine panel (not copied between repos, not Settings hooks). Then the existing factory-forward GitHub Action install on the confirmed set. [user]
6. Done — a short close, not a recap. [user]

Each beat: one short why, then the action. Pause only at owner decisions. [user]

Owner decisions (the only pauses): understand flow-next; where to apply / whether to install flow-next if they do not confirm; named repo without `.flow/`; which candidate set to install; create vs reuse builder when that choice exists; paste the two secrets. [paraphrase]

If they do not confirm at orient: do not run fleet find-repos. Ask where they want to apply this factory, and whether they want to install flow-next there. Never auto-init. A named repo is probed with existing `discover.ts --named owner/name --whitelist owner/name` (no fleet list). Install only names that targeted discover returned in `candidates`. [user]

After the owner is on the path, install mechanics stay fn-2. Discover can stay. The new work is conversation-first. Program changes only if needed. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]

Two e2e cases, documented not run in this spec: [user]

- No-builder: create a new builder + webhook; live teammates do not count as an existing builder. [user]
- Existing-builder: reuse a designated test builder only; do not create a third; never the live factory builder. [user]

Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Live same-account e2e is AFTER the skill ships. This spec's implement-now is the skill plus a short README beat. [user]

After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. Document this in the easy-install skill and the short README beat (install instructions), not only the wake prompt. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No confirm / does not understand: do not silently discover. [user]
- Ask where to apply this factory and whether to install flow-next (`/flow-next:setup`). Never auto-init. [user]
- Named repo without `.flow/` (once the owner is on the existing path): ask intent and whether to init flow-next. No auto-init, no silent skip. This is the existing fn-2 boundary, not new machinery. [user]
- After they choose `/flow-next:setup` on a named repo: re-run targeted `discover.ts --named owner/name --whitelist owner/name`; continue from you-pick only when the name is in `candidates`. Never auto-init. Never fleet-discover unless they later confirm the orient path.
- Empty candidate list after fleet discover: show the empty set; wait for a named repo or stop; do not invent a confirm set. A later named repo uses targeted discover, not a silent fleet re-scan.
- Bare `--named` still fleet-scans (`factory/discover.ts`); no-confirm / named-after-empty-list must also pass `--whitelist` for that name.
- Do not `install.ts --confirmed` a name that targeted discover did not put in `candidates`. Install does not verify `.flow/`.
- Discover exit 20: show stderr and stop; do not treat a partial list as the candidates (existing fn-2).
- Pause only at owner decisions; do not stop the walkthrough to lecture or to recap. [user]
- No secrets in git: do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git. [user]
- Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]
- Do not arm the live factory-wake. [user]
- Live teammates do not count as an existing builder. [user]
- Existing-builder case: reuse a designated test builder only; do not create a third; never the live factory builder. [user]
- Shared computer and GitHub are expected; no second login. [user]
- Throwaway product repo only. [user]
- Program tests stay stubbed bun test; they do not prove conversation or install. [user]
- Live same-account e2e is AFTER the skill ships, not this spec's implement now. [user]
- Keep generic in spec prose (owner / GitHub / builder / notify). Instance names stay out of the spec file. [user]
- After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. [user]
- ADVANCED with a dirty or unpushed tree is a fail, not quiet success. [user]
- This instruction belongs in the easy-install skill and the short README beat (install instructions), not only the wake prompt. [user]

## Acceptance Criteria
<!-- scope: both -->

Standing constraints that already live in Boundaries (secrets not in git, do not reopen fn-2, stubbed bun tests are not conversation proof) are not restated as R-IDs. [paraphrase]

- **R1:** The whole setup is a short-beat walkthrough, in this order: orient (this factory only works with flow-next / `.flow/` specs), find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action. Pause only when the owner needs to decide. No lecture at the start, no recap novel at the end. [user] Errors: starting with silent discover, assuming the owner already knows flow-next, opening with a lecture, a long closing recap, omitting a beat, reordering so discover runs before orient, extra pauses that are not owner decisions, or running a mutating beat with no why, fails this criterion.

- **R2:** If the owner confirms they understand, continue the remaining beats using the existing discover program and the existing confirm-then-install Action path (factory-forward GitHub Action + two secrets, one builder webhook, not Settings hooks). [user] Errors: skipping discover after confirm, or taking a different install path, fails this criterion.

- **R3:** If the owner does not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Never auto-init. [user] Errors: silent or fleet discover (`bun factory/discover.ts` without a whitelist constraint) after no-confirm, auto-init of flow-next / `.flow/`, skipping that ask, or installing a named repo that targeted discover did not return in `candidates`, fails this criterion.

- **R4:** Named repo without `.flow/`: same ask (where to apply / whether to install flow-next), never skip silently, never auto-init. [user] Errors: silent skip, auto-init of a named repo without `.flow/`, or installing that name without a targeted discover `candidates` hit, fails this criterion.

- **R5:** After the owner is on the path, install mechanics stay unchanged: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. [user] Errors: changing the confirm-set, minting a second builder webhook on the live factory, using Settings hooks, or a different secrets path, fails this criterion.

- **R6:** Deliverable is the skill plus a short README beat. Program changes only if needed (discover can stay; the new work is conversation-first). Live same-account e2e is AFTER the skill ships, not this spec's implement now. [user] Errors: replacing discover as the new first step, shipping the walkthrough as a silent program-only change with no conversation, or treating live e2e as implement-now, fails this criterion.

- **R7:** Same-account later-proof is documented, not run in this spec: a second main on the same account (no second login); no-builder creates a new builder + webhook (live teammates do not count); existing-builder reuses a designated test builder only (no third, never the live factory builder); throwaway product repo only; never reuse the live factory builder, live factory-wake webhook, or live secrets; do not arm live factory-wake; shared computer and GitHub are expected. [user] Errors: omitting either documented case, requiring a second login or second computer, treating live teammates as an existing builder, documenting a third builder, or using the live factory builder / wake / secrets, fails this criterion.

- **R8:** After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. This belongs in the easy-install skill AND the short README beat (install instructions), not only the wake prompt. [user] Errors: treating a dirty or unpushed tree as quiet success after ADVANCED, or documenting this only on the wake prompt and omitting it from the easy-install skill or the short README beat, fails this criterion.

## Early proof point

Task fn-3-easy-install-flow-next-onboard.1 proves the core approach (the skill can pause at orient before discover, and the no-confirm branch uses targeted `--named`+`--whitelist` discover, never a fleet list). Document-contract tests must fail on the current discover-first skill. If that cannot be expressed without a program change, re-evaluate before writing the README beat.

## Boundaries
<!-- scope: business -->

- Out of scope: reopening fn-2-easy-install-setup (status=done). Cite it as depends-on only. [user]
- Out of scope: factory runtime (fn-1, already shipping). This spec does not reopen those. [user]
- Out of scope: changing the post-understanding easy-install fire path (discover-then-confirm, one builder webhook for all Actions, factory-forward GitHub Action, owner-paste of the two existing workflow secrets, not Settings hooks). Those stay fn-2. [user]
- Out of scope: auto-init of flow-next / `.flow/`. [user]
- Out of scope: silent discover when the owner does not confirm they understand. [user]
- Out of scope: a lecture-style opening or a recap-novel close. [user]
- Out of scope: extra pauses that are not owner decisions. [user]
- Out of scope: inventing extra product machinery beyond the conversation-named discover path, `/flow-next:setup`, and `.flow/`. [paraphrase]
- Out of scope: putting secrets in git (routine URL, sender key, tokens, PATs, sessions, vault paths). [user]
- Out of scope: arming the live factory-wake, or copying live secrets as a side effect of implementing this spec. [user]
- Out of scope: reusing the live factory builder, the live factory-wake webhook, or live secrets. [user]
- Out of scope: a second login / second account for the same-account test env. [user]
- Out of scope: treating live teammates as an existing builder; creating a third builder; using the live factory builder in the existing-builder case. [user]
- Out of scope: running the two e2e cases as this spec's implement now. They are documented later proof AFTER the skill ships. [user]
- Out of scope: putting instance names in the spec file. Product-role prose stays generic (owner / GitHub / builder / notify). The test-env sentence is: a second main on the same account, new builder or reuse a designated test builder, never the live factory. [user]
- Out of scope: rewriting `factory/discover.ts` as the new first step, a new orient program, or a clicks-only UI. [paraphrase]
- Out of scope: changing `skills/factory-builder/SKILL.md` or the Wake/hand-wire path except to keep existing README contracts.
- Out of scope: treating ADVANCED with a dirty or unpushed tree as quiet success. [user]
- Out of scope: documenting the post-tick commit-and-push instruction only on the wake prompt. It belongs in the easy-install skill and the short README beat (install instructions). [user]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Easy-install currently reads as if the owner already knows flow-next. The first beat must be that understanding check so the factory is not applied by silent discover to repos the owner did not mean as flow-next product repos. [user]

That check is not the whole job. Success is a nice, smooth walkthrough of the whole setup: enough explanation, not over-explanation. [user]

If they confirm, reuse existing discover and the existing confirm-then-install Action path — success is the conversation, not a new fire path. [user]

If they do not confirm: ask where they want to apply the factory, and offer `/flow-next:setup`. Never auto-init. [user]

Whole setup as short beats: orient, find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action. Pause only when the owner needs to decide. No lecture at the start, no recap novel at the end. [user]

Conversation-first is more important than program changes: skill + short README; discover can stay; program changes only if needed. [user]

Do not reopen fn-2. Do not auto-init. Do not silently discover without confirm. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]

Two e2e cases are documented, not run in this spec: no-builder (create a new builder + webhook; live teammates do not count as an existing builder) and existing-builder (reuse a designated test builder only; do not create a third; never the live factory builder). [user]

Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Live same-account e2e is AFTER the skill ships, not this spec's implement now. [user]

Keep generic in spec prose (owner / GitHub / builder / notify). Instance names stay out of the spec file. [user]

After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. This belongs in the easy-install skill and the short README beat (install instructions), not only the wake prompt. [user]

### Plan decisions

- Rejected making `factory/discover.ts` the new first step: the owner would still hit silent discover before they understand flow-next. Orient is a skill pause.
- Rejected a new orient program or CLI flag: conversation-first; program changes only if needed.
- Rejected bare `--named` as the no-confirm probe: it still fleet-lists. Use existing `--named owner/name --whitelist owner/name` as a one-shot named constraint (not a frozen repo allowlist).
- Rejected trusting `install.ts --confirmed` to verify `.flow/`: it does not; the skill installs only targeted `candidates`.
- Rejected a lecture-style FAQ or closing recap: each beat is one short why, then the action.
- Rejected running the two same-account e2e cases in this spec: document later-proof only (R6, R7).
- Capture-time "not ready / spec only" is spent: this plan is the implementation decomposition of a ready spec.

## Quick commands

```bash
bun test tests/factory/discover.test.ts tests/factory/install.test.ts tests/factory/notify.test.ts
bun test
```

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1  | Short-beat walkthrough in order; pause only at owner decisions | fn-3-easy-install-flow-next-onboard.1 | — |
| R2  | Understand-confirm → existing discover + confirm-then-install | fn-3-easy-install-flow-next-onboard.1 | — |
| R3  | No-confirm: no silent discover; ask where / whether `/flow-next:setup`; never auto-init | fn-3-easy-install-flow-next-onboard.1 | — |
| R4  | Named repo without `.flow/`: same ask; never skip or auto-init | fn-3-easy-install-flow-next-onboard.1 | — |
| R5  | Install mechanics stay fn-2 after the owner is on the path | fn-3-easy-install-flow-next-onboard.1 | — |
| R6  | Skill + short README beat; program changes only if needed; e2e not implement-now | fn-3-easy-install-flow-next-onboard.1, fn-3-easy-install-flow-next-onboard.2 | — |
| R7  | Same-account later-proof documented, not run | fn-3-easy-install-flow-next-onboard.2 | — |
| R8  | After every factory tick, if the tree moved, commit (if needed) and push to the spec branch; ADVANCED with a dirty or unpushed tree is a fail; document in the easy-install skill AND the short README beat, not only the wake prompt | — | spec-only fold; leftover plan/tasks already shipped this pass and not rewritten. |

## References

- `skills/easy-install/SKILL.md` — current discover-first conversation
- `factory/discover.ts` — find-repos program (reuse)
- `factory/install.ts` — confirm-then-install boundary (reuse)
- `README.md` — Easy-install paragraph + Wake hand-wire
- `tests/factory/discover.test.ts` / `install.test.ts` — skill-string fixtures
- `tests/factory/notify.test.ts` — README contracts
- `.flow/specs/fn-2-easy-install-setup.md` — done fire path (depends-on)

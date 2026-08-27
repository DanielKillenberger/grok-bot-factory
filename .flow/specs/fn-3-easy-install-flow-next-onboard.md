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

## Goal & Context
<!-- scope: business -->
<!-- Goal & Context: 80% [user], 20% [paraphrase] -->

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

This capture is draft / not ready. Ready is owner confirmation later. Do not implement product code in this capture. [user]

## Architecture & Data Models
<!-- scope: technical -->
<!-- Architecture & Data Models: 70% [user], 30% [paraphrase] -->

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

If they do not confirm at orient: do not run find-repos. Ask where they want to apply this factory, and whether they want to install flow-next there. Never auto-init. [user]

After the owner is on the path, install mechanics stay fn-2. Discover can stay. The new work is conversation-first. Program changes only if needed. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]

Two e2e cases, documented not run in this spec: [user]

- No-builder: create a new builder + webhook; live teammates do not count as an existing builder. [user]
- Existing-builder: reuse a designated test builder only; do not create a third; never the live factory builder. [user]

Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Live same-account e2e is AFTER the skill ships. This spec's implement-now is the skill plus a short README beat. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No confirm / does not understand: do not silently discover. [user]
- Ask where to apply this factory and whether to install flow-next (`/flow-next:setup`). Never auto-init. [user]
- Named repo without `.flow/` (once the owner is on the existing path): ask intent and whether to init flow-next. No auto-init, no silent skip. This is the existing fn-2 boundary, not new machinery. [user]
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
- Ready remains false. Do not implement product code in this capture. Spec only. [user]

## Acceptance Criteria
<!-- scope: both -->

Standing constraints that already live in Boundaries (secrets not in git, do not reopen fn-2, stubbed bun tests are not conversation proof) are not restated as R-IDs. [paraphrase]

- **R1:** The whole setup is a short-beat walkthrough, in this order: orient (this factory only works with flow-next / `.flow/` specs), find repos, you pick, builder/webhook, paste two secrets, done. Each beat is one short why, then the action. Pause only when the owner needs to decide. No lecture at the start, no recap novel at the end. [user] Errors: starting with silent discover, assuming the owner already knows flow-next, opening with a lecture, a long closing recap, omitting a beat, reordering so discover runs before orient, extra pauses that are not owner decisions, or running a mutating beat with no why, fails this criterion.

- **R2:** If the owner confirms they understand, continue the remaining beats using the existing discover program and the existing confirm-then-install Action path (factory-forward GitHub Action + two secrets, one builder webhook, not Settings hooks). [user] Errors: skipping discover after confirm, or taking a different install path, fails this criterion.

- **R3:** If the owner does not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Never auto-init. [user] Errors: silent discover, auto-init of flow-next / `.flow/`, or skipping that ask, fails this criterion.

- **R4:** Named repo without `.flow/`: same ask (where to apply / whether to install flow-next), never skip silently, never auto-init. [user] Errors: silent skip or auto-init of a named repo without `.flow/` fails this criterion.

- **R5:** After the owner is on the path, install mechanics stay unchanged: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. [user] Errors: changing the confirm-set, minting a second builder webhook on the live factory, using Settings hooks, or a different secrets path, fails this criterion.

- **R6:** Deliverable is the skill plus a short README beat. Program changes only if needed (discover can stay; the new work is conversation-first). Live same-account e2e is AFTER the skill ships, not this spec's implement now. [user] Errors: replacing discover as the new first step, shipping the walkthrough as a silent program-only change with no conversation, or treating live e2e as implement-now, fails this criterion.

- **R7:** Same-account later-proof is documented, not run in this spec: a second main on the same account (no second login); no-builder creates a new builder + webhook (live teammates do not count); existing-builder reuses a designated test builder only (no third, never the live factory builder); throwaway product repo only; never reuse the live factory builder, live factory-wake webhook, or live secrets; do not arm live factory-wake; shared computer and GitHub are expected. [user] Errors: omitting either documented case, requiring a second login or second computer, treating live teammates as an existing builder, documenting a third builder, or using the live factory builder / wake / secrets, fails this criterion.

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
- Out of scope: implementing product code in this capture (spec only). [user]
- Out of scope: putting secrets in git (routine URL, sender key, tokens, PATs, sessions, vault paths). [user]
- Out of scope: arming the live factory-wake, or copying live secrets as a side effect of implementing this spec. [user]
- Out of scope: reusing the live factory builder, the live factory-wake webhook, or live secrets. [user]
- Out of scope: a second login / second account for the same-account test env. [user]
- Out of scope: treating live teammates as an existing builder; creating a third builder; using the live factory builder in the existing-builder case. [user]
- Out of scope: running the two e2e cases as this spec's implement now. They are documented later proof AFTER the skill ships. [user]
- Out of scope: putting instance names in the spec file. Product-role prose stays generic (owner / GitHub / builder / notify). The test-env sentence is: a second main on the same account, new builder or reuse a designated test builder, never the live factory. [user]
- Ready is owner confirmation later. This capture does not mark the spec ready. [user]

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

Ready remains false. Do not implement. [user]

## Requirement coverage

| R-ID | Task |
|------|------|
| R1 | fn-3.M (TBD — populate via /flow-next:plan) |
| R2 | fn-3.M (TBD — populate via /flow-next:plan) |
| R3 | fn-3.M (TBD — populate via /flow-next:plan) |
| R4 | fn-3.M (TBD — populate via /flow-next:plan) |
| R5 | fn-3.M (TBD — populate via /flow-next:plan) |
| R6 | fn-3.M (TBD — populate via /flow-next:plan) |
| R7 | fn-3.M (TBD — populate via /flow-next:plan) |

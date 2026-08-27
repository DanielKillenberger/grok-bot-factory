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

> user (turn 10): "Do not implement product code in this capture. Spec only."

> user (turn 11, standing/fn-2): "Easy-install after the owner understands: discover-then-confirm, then one builder webhook routine + factory-forward GitHub Action + workflow secrets GROK_BOT_WEBHOOK_URL and GROK_BOT_SENDER_KEY (owner paste from the routine panel). Not Settings→Webhooks."

> user (turn 12, standing/fn-2): "Named repo without `.flow/`: ask intent and whether to init flow-next. No auto-init, no silent skip."

> user (turn 13, standing/fn-2): "One builder webhook for all Actions. Do not mint a second routine."

> user (turn 14, standing/fn-2): "Factory runtime is fn-1 (already shipping). This spec does not reopen those."

> user (turn 15): "Program tests stay stubbed bun test. They do not prove conversation or install."

> user (turn 16): "Named repo without `.flow/`: same ask, never skip silently, never auto-init."

> user (turn 17): "Rest of easy-install unchanged after the onboard gate."

> user (turn 18): "Deliverable is skill + a short README beat; program changes only if needed (discover can stay)."

> user (turn 19): "Same-account test env (no second login): a second main on the same account. Never reuse the live factory builder or the live factory-wake webhook or live secrets."

> user (turn 20): "Two e2e cases (documented, not run in this spec): (a) no builder — create a new builder + webhook; live teammates do not count as an existing builder; (b) existing builder — reuse a designated test builder only, do not create a third, never the live factory builder."

> user (turn 21): "Throwaway product repo only. Do not arm live factory-wake. Shared computer/GitHub is expected."

> user (turn 22): "Program tests stay stubbed bun test; they do not prove conversation or install. Live same-account e2e is AFTER the skill ships, not this spec's implement now."

> user (turn 23): "Keep generic in spec prose (owner / builder / notify). Instance names stay out of the spec file; the test-env is \"a second main on the same account, new builder or reuse a designated test builder, never the live factory.\""

> user (turn 24): "Still: first explain flow-next; confirm → discover + Action install; no confirm → ask repo + offer `/flow-next:setup`; never auto-init."

> user (turn 25): "fn-2 stays done. Skill + short README. Discover program can stay."

> user (turn 26): "Still not ready. Do not implement product code. Spec only."

> user (turn 27): "Do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git."

## Overview

Easy-install today assumes the owner already knows flow-next. [user]

The first step is to explain that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]

If the owner confirms they understand: run discover (`bun factory/discover.ts`), then the existing confirm-then-install path (factory-forward GitHub Action + two secrets, one builder webhook, not Settings hooks). [user]

If they do not confirm: do not silently discover. Ask where they want to apply the factory, and whether to install flow-next there (`/flow-next:setup`). Never auto-init. [user]

Named repo without `.flow/`: same ask, never skip silently, never auto-init. [user]

After the onboard gate, the rest of easy-install is unchanged. [user]

Deliverable is the skill plus a short README beat. Discover program can stay. Program changes only if needed. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]

Two e2e cases, documented not run in this spec: [user]

- No-builder: create a new builder + webhook; live teammates do not count as an existing builder. [user]
- Existing-builder: reuse a designated test builder only; do not create a third; never the live factory builder. [user]

Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Live same-account e2e is AFTER the skill ships, not this spec's implement now. [user]

fn-2 stays done. Ready remains false. Do not implement. [user]

Keep generic in spec prose: owner / GitHub / builder / notify. Instance names stay out of the spec file. [user]

## Goal & Context
<!-- scope: business -->
<!-- Goal & Context: 100% [user] -->

Easy-install currently reads as if the owner already knows flow-next (`.flow/`, `/flow-next:setup`, fn-1 ticks, review pins). [user]

This spec adds a conversation-first onboard gate so the owner is told that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs) before discover. [user]

Target user: the owner. Product-role language stays generic: owner / GitHub / builder / notify. Instance names stay out of the spec file. [user]

If they confirm they understand: run discover, then existing confirm-then-install. If they do not confirm: ask where they want to apply the factory, and whether to install flow-next there (`/flow-next:setup`). Never auto-init. [user]

Why now: the rest of easy-install (confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks) already ships on fn-2-easy-install-setup (status=done). That path is not this spec's work. [user]

Deliverable is the skill plus a short README beat. Discover program can stay. [user]

Program tests stay stubbed bun test. They do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Two e2e cases are documented later-proof to run AFTER the skill ships, not this spec's implement now. [user]

This capture is draft / not ready. Ready is owner confirmation later. Do not implement. [user]

## Architecture & Data Models
<!-- scope: technical -->
<!-- Architecture & Data Models: 100% [user] -->

Easy-install's new first step is a conversation check, not a silent program. [user]

1. Explain that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]
2. If the owner confirms they understand: run existing discover (`bun factory/discover.ts`) and continue the existing confirm-then-install Action path (factory-forward GitHub Action + two secrets, one builder webhook, not Settings hooks). [user]
3. If they do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Never auto-init. [user]
4. Named repo without `.flow/`: same ask, never skip silently, never auto-init. [user]
5. After that onboard gate, the rest of easy-install is unchanged. [user]

Discover can stay. The new branch is conversation-first. Program changes only if needed. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user]

Two e2e cases, documented not run in this spec: [user]

- No-builder: create a new builder + webhook; live teammates do not count as an existing builder. [user]
- Existing-builder: reuse a designated test builder only; do not create a third; never the live factory builder. [user]

Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user]

Live same-account e2e is AFTER the skill ships, not this spec's implement now. This spec's implement-now is the skill plus a short README beat. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No confirm / does not understand: do not silently discover. [user]
- Ask where to apply this factory and whether to install flow-next (`/flow-next:setup`). Never auto-init. [user]
- Named repo without `.flow/` (after the owner is on the existing path): ask intent and whether to init flow-next. No auto-init, no silent skip. This is the existing fn-2 boundary, not new machinery. [user]
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
- Do not implement product code in this capture. Spec only. [user]
- Ready remains false. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Easy-install's first step is the flow-next understanding check: explain that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user] Errors: starting with silent discover, or assuming the owner already knows flow-next, fails this criterion.

- **R2:** If the owner confirms they understand, discover flow-next repos with the existing `bun factory/discover.ts` path and continue the existing confirm-then-install Action path (factory-forward GitHub Action + two secrets, one builder webhook, not Settings hooks). [user] Errors: skipping discover after confirm, or taking a different install path, fails this criterion.

- **R3:** If the owner does not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Never auto-init. [user] Errors: silent discover, auto-init of flow-next / `.flow/`, or skipping that ask, fails this criterion.

- **R4:** Named repo without `.flow/`: same ask (where to apply / whether to install flow-next), never skip silently, never auto-init. [user] Errors: silent skip or auto-init of a named repo without `.flow/` fails this criterion.

- **R5:** After that onboard gate, the rest of easy-install is unchanged: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. [user] Errors: changing the confirm-set, minting a second builder webhook on the live factory, using Settings hooks, or a different secrets path, fails this criterion.

- **R6:** Deliverable is the skill plus a short README beat. Program changes only if needed (discover can stay; the new branch is conversation-first). [user] Errors: replacing discover as the new first step, or shipping the onboard gate as a silent program-only change with no conversation, fails this criterion.

- **R7:** Routine URL, sender key, tokens, PATs, sessions, and vault paths are not written to git. [user] Errors: reject any change that embeds them.

- **R8:** Do not reopen fn-2-easy-install-setup (status=done). [user] Errors: rewriting or reopening fn-2-easy-install-setup, or restating its shipping contracts as new work, fails this criterion.

- **R9:** Program tests stay stubbed bun test. They do not prove conversation or install. [user] Errors: treating program tests as conversation proof or install proof fails this criterion.

- **R10:** Same-account test env (no second login): a second main on the same account, new builder or reuse a designated test builder, never the live factory. Never reuse the live factory builder or the live factory-wake webhook or live secrets. [user] Errors: requiring a second login, reusing the live factory builder, reusing the live factory-wake webhook, or reusing live secrets, fails this criterion.

- **R11:** Two e2e cases are documented, not run in this spec. [user] Errors: omitting either documented case, or treating live e2e as this spec's implement-now, fails this criterion.

- **R12:** No-builder case (documented later proof): create a new builder + webhook; live teammates do not count as an existing builder. [user] Errors: treating live teammates as an existing builder, or failing to document creating a new builder + webhook for the no-builder case, fails this criterion.

- **R13:** Existing-builder case (documented later proof): reuse a designated test builder only; do not create a third; never the live factory builder. [user] Errors: documenting creation of a third builder, or using the live factory builder, fails this criterion.

- **R14:** Throwaway product repo only. Do not arm live factory-wake. Shared computer and GitHub are expected. [user] Errors: arming the live factory-wake, omitting the throwaway product repo, or requiring a second login / second computer, fails this criterion.

- **R15:** Live same-account e2e is AFTER the skill ships, not this spec's implement now. This spec's implement-now is the skill plus a short README beat. [user] Errors: treating live same-account e2e as implement-now work of this spec fails this criterion.

- **R16:** Ready remains false. Do not implement product code in this capture. Spec only. [user] Errors: marking this spec ready, or implementing product code in this capture, fails this criterion.

## Boundaries
<!-- scope: business -->

- Out of scope: reopening fn-2-easy-install-setup (status=done). Cite it as depends-on only. [user]
- Out of scope: factory runtime (fn-1, already shipping). This spec does not reopen those. [user]
- Out of scope: changing the post-understanding easy-install path (discover-then-confirm, one builder webhook for all Actions, factory-forward GitHub Action, owner-paste of the two existing workflow secrets, not Settings hooks). Those stay fn-2. [user]
- Out of scope: auto-init of flow-next / `.flow/`. [user]
- Out of scope: silent discover when the owner does not confirm they understand. [user]
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

Easy-install currently reads as if the owner already knows flow-next. The first step must be that understanding check so the factory is not applied by silent discover to repos the owner did not mean as flow-next product repos. [user]

If they confirm, reuse existing discover and the existing confirm-then-install Action path — success is the onboard gate, not a new fire path. [user]

If they do not confirm: ask where they want to apply the factory, and offer `/flow-next:setup`. Never auto-init. [user]

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
| R8 | fn-3.M (TBD — populate via /flow-next:plan) |
| R9 | fn-3.M (TBD — populate via /flow-next:plan) |
| R10 | fn-3.M (TBD — populate via /flow-next:plan) |
| R11 | fn-3.M (TBD — populate via /flow-next:plan) |
| R12 | fn-3.M (TBD — populate via /flow-next:plan) |
| R13 | fn-3.M (TBD — populate via /flow-next:plan) |
| R14 | fn-3.M (TBD — populate via /flow-next:plan) |
| R15 | fn-3.M (TBD — populate via /flow-next:plan) |
| R16 | fn-3.M (TBD — populate via /flow-next:plan) |

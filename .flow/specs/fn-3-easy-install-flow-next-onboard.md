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

> user (turn 14, standing/fn-2): "Identity: User-Agent `factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. Fail closed if identity cannot be recovered. Never assume a single repo."

> user (turn 15, standing/fn-2): "Factory runtime is fn-1 (already shipping). This spec does not reopen those."

> user (turn 16): "Program tests stay stubbed bun test. They do not prove conversation or install."

> user (turn 17): "Install proof is a second Grok Bot env on the SAME account (no second login): a new main agent, a new builder (do not reuse the live factory builder), that builder's own webhook routine (do not mint a second routine on the live factory), and a throwaway product repo. Shared computer and GitHub are expected. The skill must refuse to reuse the live factory builder/webhook."

> user (turn 18): "Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec."

> user (turn 19): "Test main is Installer (046195df-ab63-4a81-9053-b64d7bde8263). Lock that as the same-account test env: a fake main whose instructions forbid reusing existing bots, the live factory webhook, or live secrets. New builder + new webhook + throwaway repo for the no-builder case."

> user (turn 20): "Two e2e cases on the same account."

> user (turn 21): "No-builder case: Installer creates a new builder + new webhook. Live teammates (John etc.) do not count as an existing builder."

> user (turn 22): "Existing-builder case: reuse Test builder (de5ad5de-581c-4edd-95aa-627c9dae859d) only. Do not create a third. Never John."

> user (turn 23): "Still not ready. Do not implement."

> user (turn 24): "Keep product-role language generic (owner / GitHub / builder / notify) except these locked test-env names/ids: Installer, Test builder, John-as-not-a-builder. Do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git."

## Overview

Easy-install today assumes the owner already knows flow-next. [user]

The first step is to make sure the owner knows this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]

If they confirm they understand: discover flow-next repos with the existing `bun factory/discover.ts` path, then continue the existing confirm-then-install Action path. [user]

If they do not understand / do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user]

After that onboard gate, the rest of easy-install is unchanged. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Install proof is a second Grok Bot env on the same account (no second login). [user]

Test main is Installer (046195df-ab63-4a81-9053-b64d7bde8263): a fake main whose instructions forbid reusing existing bots, the live factory webhook, or live secrets. [user]

Two e2e cases on that same account: [user]

- No-builder: Installer creates a new builder + new webhook. Live teammates (John etc.) do not count as an existing builder. [user]
- Existing-builder: reuse Test builder (de5ad5de-581c-4edd-95aa-627c9dae859d) only. Do not create a third. Never John. [user]

The skill must refuse to reuse the live factory builder/webhook. [user]

Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec. [user]

Ready remains false. Do not implement. [user]

## Goal & Context
<!-- scope: business -->
<!-- Goal & Context: 95% [user], 5% [paraphrase] -->

Easy-install currently reads as if the owner already knows flow-next (`.flow/`, `/flow-next:setup`, fn-1 ticks, review pins). [user]

This spec adds a conversation-first onboard gate so the owner is asked that understanding check before discover. The factory only works with flow-next product repos (repos that have flow-next / `.flow/` specs). [user]

Target user: the owner. Product-role language stays generic: owner / GitHub / builder / notify. Locked test-env names/ids are the exception: Installer, Test builder, and John (as not a builder). [user]

Why now: the rest of easy-install (confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks) already ships on fn-2-easy-install-setup (status=done). That path is not this spec's work. [user]

Program tests stay stubbed bun test. They do not prove conversation or install. Install proof is the same-account second Grok Bot env (no second login). [user]

This capture is draft / not ready. Ready is owner confirmation later. Do not implement. [user]

## Architecture & Data Models
<!-- scope: technical -->
<!-- Architecture & Data Models: 95% [user], 5% [paraphrase] -->

Easy-install's new first step is a conversation check, not a silent program. [user]

1. Ask whether the owner understands that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]
2. If they confirm they understand: run existing discover (`bun factory/discover.ts`) and continue the existing confirm-then-install Action path. [user]
3. If they do not understand / do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user]
4. After that gate, the rest of easy-install is unchanged. [user]

Discover can stay. The new branch is conversation-first. Program changes only if needed. [user]

Program tests stay stubbed bun test and do not prove conversation or install. [user]

Install proof is a second Grok Bot env on the same account (no second login): a new main agent, a new builder (do not reuse the live factory builder), that builder's own webhook routine (do not mint a second routine on the live factory), and a throwaway product repo. Shared computer and GitHub are expected. [user]

The skill must refuse to reuse the live factory builder/webhook. [user]

Test main is Installer (046195df-ab63-4a81-9053-b64d7bde8263), locked as the same-account test env: a fake main whose instructions forbid reusing existing bots, the live factory webhook, or live secrets. New builder + new webhook + throwaway repo for the no-builder case. [user]

Two e2e cases on that same account: [user]

- No-builder: Installer creates a new builder + new webhook. Live teammates (John etc.) do not count as an existing builder. [user]
- Existing-builder: reuse Test builder (de5ad5de-581c-4edd-95aa-627c9dae859d) only. Do not create a third. Never John. [user]

Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No confirm / does not understand: do not silently discover. [user]
- Ask where to apply this factory and whether to install flow-next (`/flow-next:setup`). Do not auto-init. [user]
- Named repo without `.flow/` (after the owner is on the existing path): ask intent and whether to init flow-next. No auto-init, no silent skip. This is the existing fn-2 boundary, not new machinery. [user]
- No secrets in git: do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git. [user]
- Skill must refuse to reuse the live factory builder/webhook. [user]
- Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec. [user]
- Live teammates (John etc.) do not count as an existing builder. [user]
- Existing-builder case: never create a third builder; never John. [user]
- Do not mint a second routine on the live factory. The no-builder case's new webhook is the new builder's own routine, not a second live-factory routine. [user]
- Shared computer and GitHub are expected; no second login. [user]
- Program tests stay stubbed bun test; they do not prove conversation or install. [user]
- Do not implement product code in this capture. Spec only. [user]
- Ready remains false. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Easy-install's first step is the flow-next understanding check: make sure the owner knows this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user] Errors: starting with silent discover, or assuming the owner already knows flow-next, fails this criterion.

- **R2:** If the owner confirms they understand, discover flow-next repos with the existing `bun factory/discover.ts` path and continue the existing confirm-then-install Action path. [user] Errors: skipping discover after confirm, or taking a different install path, fails this criterion.

- **R3:** If the owner does not understand / does not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user] Errors: silent discover, auto-init of flow-next / `.flow/`, or skipping that ask, fails this criterion.

- **R4:** After that onboard gate, the rest of easy-install is unchanged: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. [user] Errors: changing the confirm-set, minting a second builder webhook on the live factory, using Settings hooks, or a different secrets path, fails this criterion.

- **R5:** Deliverable is the skill plus maybe a short README beat. Program changes only if needed (discover can stay; the new branch is conversation-first). [user] Errors: replacing discover as the new first step, or shipping the onboard gate as a silent program-only change with no conversation, fails this criterion.

- **R6:** Routine URL, sender key, tokens, PATs, sessions, and vault paths are not written to git. [user] Errors: reject any change that embeds them.

- **R7:** Do not reopen fn-2-easy-install-setup (status=done). This is a new spec. [user] Errors: rewriting or reopening fn-2-easy-install-setup, or restating its shipping contracts as new work, fails this criterion.

- **R8:** Program tests stay stubbed bun test. They do not prove conversation or install. [user] Errors: treating program tests as conversation proof or install proof fails this criterion.

- **R9:** Install proof is a second Grok Bot env on the same account (no second login): a new main agent, a new builder (do not reuse the live factory builder), that builder's own webhook routine (do not mint a second routine on the live factory), and a throwaway product repo. Shared computer and GitHub are expected. [user] Errors: requiring a second login, reusing the live factory builder, minting a second routine on the live factory, or omitting the throwaway product repo, fails this criterion.

- **R10:** The skill must refuse to reuse the live factory builder/webhook. [user] Errors: an install-proof path that reuses the live factory builder or the live factory webhook fails this criterion.

- **R11:** Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec. [user] Errors: arming the live factory-wake, or copying live secrets as a side effect of implementing this spec, fails this criterion.

- **R12:** Test main is Installer (046195df-ab63-4a81-9053-b64d7bde8263), locked as the same-account test env: a fake main whose instructions forbid reusing existing bots, the live factory webhook, or live secrets. New builder + new webhook + throwaway repo for the no-builder case. [user] Errors: using a different test main, instructions that allow reusing existing bots / the live factory webhook / live secrets, or skipping new builder + new webhook + throwaway repo for the no-builder case, fails this criterion.

- **R13:** Two e2e cases on that same account. [user] Errors: omitting either case, or running the cases on a different account, fails this criterion.

- **R14:** No-builder case: Installer creates a new builder + new webhook. Live teammates (John etc.) do not count as an existing builder. [user] Errors: treating live teammates (John etc.) as an existing builder, or failing to create a new builder + new webhook in the no-builder case, fails this criterion.

- **R15:** Existing-builder case: reuse Test builder (de5ad5de-581c-4edd-95aa-627c9dae859d) only. Do not create a third. Never John. [user] Errors: creating a third builder, using John, or using any builder other than Test builder in the existing-builder case, fails this criterion.

- **R16:** Ready remains false. Do not implement. [user] Errors: marking this spec ready, or implementing product code in this capture, fails this criterion.

## Boundaries
<!-- scope: business -->

- Out of scope: reopening fn-2-easy-install-setup (status=done). Cite it as depends-on only. [user]
- Out of scope: factory runtime (fn-1, already shipping). This spec does not reopen those. [user]
- Out of scope: changing the post-understanding easy-install path (discover-then-confirm, one builder webhook for all Actions, factory-forward GitHub Action, owner-paste of the two existing workflow secrets, not Settings hooks, fail-closed identity). Those stay fn-2. [user]
- Out of scope: auto-init of flow-next / `.flow/`. [user]
- Out of scope: silent discover when the owner does not confirm they understand. [user]
- Out of scope: inventing extra product machinery or new file paths beyond the conversation-named `bun factory/discover.ts`, `/flow-next:setup`, and `.flow/`. [paraphrase]
- Out of scope: implementing product code in this capture (spec only). [user]
- Out of scope: putting secrets in git (routine URL, sender key, tokens, PATs, sessions, vault paths). [user]
- Out of scope: arming the live factory-wake, or copying live secrets as a side effect of implementing this spec. [user]
- Out of scope: reusing the live factory builder/webhook. [user]
- Out of scope: a second login / second account for install proof. [user]
- Out of scope: treating live teammates (John etc.) as an existing builder; creating a third builder; using John in the existing-builder case. [user]
- Product-role prose stays generic (owner / GitHub / builder / notify) except the locked test-env names/ids: Installer, Test builder, John-as-not-a-builder. [user]
- Ready is owner confirmation later. This capture does not mark the spec ready. [user]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Easy-install currently reads as if the owner already knows flow-next. The first step must be that understanding check so the factory is not applied by silent discover to repos the owner did not mean as flow-next product repos. [user]

If they confirm, reuse existing discover and the existing confirm-then-install Action path — success is the onboard gate, not a new fire path. [user]

Conversation-first is more important than program changes: skill + maybe a short README beat; discover can stay; program changes only if needed. [user]

Do not reopen fn-2. Do not auto-init. Do not silently discover without confirm. [user]

Program tests stay stubbed bun test and do not prove conversation or install. Install proof is the same-account second Grok Bot env (no second login), not a second live factory. [user]

Lock Installer (046195df-ab63-4a81-9053-b64d7bde8263) as the fake main. Two e2e cases on that account: no-builder (new builder + new webhook; John etc. are not an existing builder) and existing-builder (Test builder de5ad5de-581c-4edd-95aa-627c9dae859d only; do not create a third; never John). [user]

The skill must refuse to reuse the live factory builder/webhook. Do not arm the live factory-wake. Do not copy live secrets as a side effect of implementing this spec. [user]

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

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

## Overview

Easy-install today assumes the owner already knows flow-next. [user]

The first step is to make sure the owner knows this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]

If they confirm they understand: discover flow-next repos with the existing `bun factory/discover.ts` path, then continue the existing confirm-then-install Action path. [user]

If they do not understand / do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user]

After that onboard gate, the rest of easy-install is unchanged. [user]

## Goal & Context
<!-- scope: business -->
<!-- Goal & Context: 90% [user], 10% [paraphrase] -->

Easy-install currently reads as if the owner already knows flow-next (`.flow/`, `/flow-next:setup`, fn-1 ticks, review pins). [user]

This spec adds a conversation-first onboard gate so the owner is asked that understanding check before discover. The factory only works with flow-next product repos (repos that have flow-next / `.flow/` specs). [user]

Target user: the owner. Roles in this spec stay generic: owner / GitHub / builder / notify. No personal names. [user]

Why now: the rest of easy-install (confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks) already ships on fn-2-easy-install-setup (status=done). That path is not this spec's work. [user]

This capture is draft / not ready. Ready is owner confirmation later. [user]

## Architecture & Data Models
<!-- scope: technical -->
<!-- Architecture & Data Models: 85% [user], 15% [paraphrase] -->

Easy-install's new first step is a conversation check, not a silent program. [user]

1. Ask whether the owner understands that this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user]
2. If they confirm they understand: run existing discover (`bun factory/discover.ts`) and continue the existing confirm-then-install Action path. [user]
3. If they do not understand / do not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user]
4. After that gate, the rest of easy-install is unchanged. [user]

Discover can stay. The new branch is conversation-first. Program changes only if needed. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No confirm / does not understand: do not silently discover. [user]
- Ask where to apply this factory and whether to install flow-next (`/flow-next:setup`). Do not auto-init. [user]
- Named repo without `.flow/` (after the owner is on the existing path): ask intent and whether to init flow-next. No auto-init, no silent skip. This is the existing fn-2 boundary, not new machinery. [user]
- No secrets in git: do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git. [user]
- Do not arm live repos as a side effect of this spec. [paraphrase]
- Do not implement product code in this capture. Spec only. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Easy-install's first step is the flow-next understanding check: make sure the owner knows this factory only works with flow-next (product repos that have flow-next / `.flow/` specs). [user] Errors: starting with silent discover, or assuming the owner already knows flow-next, fails this criterion.

- **R2:** If the owner confirms they understand, discover flow-next repos with the existing `bun factory/discover.ts` path and continue the existing confirm-then-install Action path. [user] Errors: skipping discover after confirm, or taking a different install path, fails this criterion.

- **R3:** If the owner does not understand / does not confirm: do not silently discover. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init. [user] Errors: silent discover, auto-init of flow-next / `.flow/`, or skipping that ask, fails this criterion.

- **R4:** After that onboard gate, the rest of easy-install is unchanged: confirm set, one builder webhook, factory-forward GitHub Action + two secrets, not Settings hooks. [user] Errors: changing the confirm-set, minting a second builder webhook, using Settings hooks, or a different secrets path, fails this criterion.

- **R5:** Deliverable is the skill plus maybe a short README beat. Program changes only if needed (discover can stay; the new branch is conversation-first). [user] Errors: replacing discover as the new first step, or shipping the onboard gate as a silent program-only change with no conversation, fails this criterion.

- **R6:** Routine URL, sender key, tokens, PATs, sessions, and vault paths are not written to git. [user] Errors: reject any change that embeds them.

- **R7:** Do not reopen fn-2-easy-install-setup (status=done). This is a new spec. [user] Errors: rewriting or reopening fn-2-easy-install-setup, or restating its shipping contracts as new work, fails this criterion.

## Boundaries
<!-- scope: business -->

- Out of scope: reopening fn-2-easy-install-setup (status=done). Cite it as depends-on only. [user]
- Out of scope: factory runtime (fn-1, already shipping). This spec does not reopen those. [user]
- Out of scope: changing the post-understanding easy-install path (discover-then-confirm, one builder webhook for all Actions, factory-forward GitHub Action, owner-paste of the two existing workflow secrets, not Settings hooks, fail-closed identity). Those stay fn-2. [user]
- Out of scope: auto-init of flow-next / `.flow/`. [user]
- Out of scope: silent discover when the owner does not confirm they understand. [user]
- Out of scope: inventing extra product machinery or new file paths beyond the conversation-named `bun factory/discover.ts`, `/flow-next:setup`, and `.flow/`. [paraphrase]
- Out of scope: implementing product code in this capture (spec only). [user]
- Out of scope: putting secrets in git; personal names in spec prose. [user]
- Ready is owner confirmation later. This capture does not mark the spec ready. [user]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Easy-install currently reads as if the owner already knows flow-next. The first step must be that understanding check so the factory is not applied by silent discover to repos the owner did not mean as flow-next product repos. [user]

If they confirm, reuse existing discover and the existing confirm-then-install Action path — success is the onboard gate, not a new fire path. [user]

Conversation-first is more important than program changes: skill + maybe a short README beat; discover can stay; program changes only if needed. [user]

Do not reopen fn-2. Do not auto-init. Do not silently discover without confirm. [user]

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

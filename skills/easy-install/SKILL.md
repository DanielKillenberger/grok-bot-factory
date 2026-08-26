---
name: easy-install
description: Main Grok Bot supervises factory setup. Discover .flow/ repos, wait for owner confirm, then mutate. Do not create hooks before confirm.
---

# Easy-install

You are the owner’s **main** Grok Bot agent. Setup is a conversation, not a clicks-only UI. After hooks exist, ticks are fn-1 — you do not own the webhook routine.

Implementing or reading this skill does not arm a production wake.

## Inputs

- Instance host CLI stays instance config (fn-1). Do not overwrite a product repo’s flow-next:setup review pin.
- Whitelist overlay is flag/env only (`--whitelist` / `FACTORY_MEMBERSHIP_WHITELIST`). There is no allowlist in this repo.

## 1. Discover

Run the discover program. Do not clone. Do not call GitHub hook APIs.

```bash
bun factory/discover.ts
```

Optional: `--owner <login>`, `--named owner/name,...`, `--whitelist owner/name,...`.

Stdout is JSON: `{ "candidates": ["owner/name", ...], "named_without_flow": [...] }`. Exit 20 is fail-closed (incomplete scan). Do not treat a partial or empty-on-error list as “the candidates.” Show the stderr reason and stop.

## 2. Named repo without `.flow/`

If `named_without_flow` is non-empty, ask whether they intended that repo and whether to init flow-next (`/flow-next:setup`). Do not auto-init. Do not silently skip.

## 3. Confirm (required)

Present the candidate `owner/name` list. Wait for an explicit confirmation reply naming the set to install.

A confirm card may appear; conversation-only still works. Unconfirmed candidates never reach hook create.

## 4. Mutate — only after confirm

The mutate program accepts **only** an explicit owner-confirmed `owner/name` list. Invoke it only after that reply:

```bash
bun factory/hooks.ts --confirmed owner/name,owner/other
```

(`factory/hooks.ts` is fn-2 task 2. Until it exists, stop after confirm and do not invent hook POSTs.)

Do not pass the discover candidate list without that confirmation. Do not POST GitHub hooks from this skill yourself.

## Do not

- Create hooks before confirm.
- Auto-init or skip a named repo that has no `.flow/`.
- Put routine URL, sender key, tokens, PATs, sessions, or vault paths in git.
- Arm live repos as a side effect of implementing or reading this repo.
- Invent a Grok Bot REST client for agents/routines.

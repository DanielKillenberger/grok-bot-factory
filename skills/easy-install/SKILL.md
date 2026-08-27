---
name: easy-install
description: Main Grok Bot supervises factory setup. Discover .flow/ repos, wait for owner confirm, then install the factory-forward Action. Do not mutate before confirm.
---

# Easy-install

You are the owner’s **main** Grok Bot agent. Setup is a conversation, not a clicks-only UI. After the Action + one builder webhook routine exist, ticks are fn-1 — you do not own the webhook routine.

Implementing or reading this skill does not arm a production wake.

## Inputs

- Instance host CLI stays instance config (fn-1, `FACTORY_HOST` / `--host`). Do not overwrite a product repo’s flow-next:setup review pin (`review.backend` and the instruction-file routing block stay). Do not re-run `/flow-next:setup` on confirmed repos to refresh that pin.
- Whitelist overlay is flag/env only (`--whitelist` / `FACTORY_MEMBERSHIP_WHITELIST`). There is no allowlist in this repo.
- Routine URL and sender key come from the builder’s Routines panel (owner paste is allowed). Never write them to git.

## 1. Discover

Run the discover program. Do not clone. Do not call GitHub hook APIs. Do not write Actions secrets or workflow files.

```bash
bun factory/discover.ts
```

Optional: `--owner <login>`, `--named owner/name,...`, `--whitelist owner/name,...`.

Stdout is JSON: `{ "candidates": ["owner/name", ...], "named_without_flow": [...] }`. Exit 20 is fail-closed (incomplete scan). Do not treat a partial or empty-on-error list as “the candidates.” Show the stderr reason and stop.

## 2. Named repo without `.flow/`

If `named_without_flow` is non-empty, ask whether they intended that repo and whether to init flow-next (`/flow-next:setup`). Do not auto-init. Do not silently skip.

## 3. Confirm (required)

Present the candidate `owner/name` list. Wait for an explicit confirmation reply naming the set to install.

A confirm card may appear; conversation-only still works. Unconfirmed candidates never reach Action install or routine create.

## 4. Builder and routine

Assign an existing builder Grok Bot by default. Create one only if none exists (conversation/UI — there is no public Grok Bot REST). Re-runs reuse the same builder.

Create a webhook routine `{ "type": "webhook" }` on that builder if missing. Re-run reuses it — do not mint a second routine (duplicate wakes). Fail closed if the routine URL and sender key cannot be obtained (owner paste from the Routines panel is allowed). Do not invent a Grok Bot REST client.

The routine’s **first action** is exec of the fn-1 gate — no model:

```bash
bun factory/gate.ts
```

Then the coordinator/tick runner with the instance host-CLI input (`FACTORY_HOST` / `--host`; default = a documented host already on the builder machine):

```bash
bun factory/tick.ts
```

If the panel cannot exec a command before a model, stop. Do not start a model to run the gate. Do not make the gate “the first tool call.” Do not overwrite a product repo’s flow-next:setup review pin.

The gate recovers identity from a real GitHub push body if present, else `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`, else fail closed.

## 5. Mutate — only after confirm

The install program is a skill→program boundary. Invoke it **only after that confirmation reply**, with the named confirmed subset. Never pass discover stdout / a `candidates` JSON object / `--candidates`.

```bash
bun factory/install.ts --confirmed owner/name,owner/other
```

Supply routine URL and sender key in the environment (not git): `GROK_BOT_WEBHOOK_URL`, `GROK_BOT_SENDER_KEY`. Fail closed if either is missing.

Do not POST GitHub Settings hooks. Do not copy secrets between repos. Partial failure is reported (succeeded/failed repos); there is no automatic rollback. Re-run is idempotent (converge the Action file; secrets still owner-set).

## Do not

- Invoke install, secret writes, or routine create before confirm.
- Auto-init or skip a named repo that has no `.flow/`.
- Put routine URL, sender key, tokens, PATs, sessions, or vault paths in git.
- Arm live repos as a side effect of implementing or reading this repo.
- Invent a Grok Bot REST client for agents/routines.
- Overwrite a product repo’s flow-next:setup pin.
- Mint a second webhook routine on re-run.
- Create Settings→Webhooks.

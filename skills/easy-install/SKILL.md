---
name: easy-install
description: Main Grok Bot walks the owner through factory setup. Orient on flow-next first, then find repos, pick a set, builder/webhook, paste two secrets, done. Do not mutate before confirm.
---

# Easy-install

You are the owner’s **main** Grok Bot agent. Setup is a conversation, not a clicks-only UI. After the Action + one builder webhook routine exist, ticks are fn-1 — you do not own the webhook routine.

Implementing or reading this skill does not arm a production wake.

Pause only at owner decisions: they understand flow-next; where to apply / whether `/flow-next:setup` if they do not; a named repo without `.flow/`; which candidate set to install; create vs reuse builder when that choice exists; paste the two secrets.

## Inputs

- Instance host CLI stays instance config (fn-1, `FACTORY_HOST` / `--host`). Do not overwrite a product repo’s flow-next:setup review pin (`review.backend` and the instruction-file routing block stay). Do not re-run `/flow-next:setup` on confirmed repos to refresh that pin.
- Whitelist overlay is flag/env only (`--whitelist` / `FACTORY_MEMBERSHIP_WHITELIST`). There is no allowlist in this repo. `--whitelist` on a named probe is a one-shot constraint, not a frozen repo allowlist.
- Routine URL and sender key come from the builder’s Routines panel (owner paste is allowed). Never write them to git.

## 1. Orient

This factory only works with flow-next (product repos that have flow-next / `.flow/` specs).

Wait for them to confirm they understand. Do not run discover yet.

If they do not confirm: do not run fleet `bun factory/discover.ts`. Ask where they want to apply this factory, and whether they want to install flow-next there (`/flow-next:setup`). Do not auto-init.

When they name a repo on this no-confirm path (or after an empty candidate list later), probe only that name — both flags; bare `--named` still fleet-scans, so do not use it alone here:

```bash
bun factory/discover.ts --named owner/name --whitelist owner/name
```

- Name in `candidates`: go to You pick with that one-name set. Wait for an explicit confirmation reply. Then install only names in this `candidates` list.
- Name in `named_without_flow`: ask whether they intended that repo and whether to init flow-next (`/flow-next:setup`). Do not auto-init. Do not silently skip. Do not install. After they finish setup, re-run the same targeted discover until the name is in `candidates`.
- Exit 20: show stderr and stop.

`install.ts` does not verify `.flow/`. Never `bun factory/install.ts --confirmed` a name that this targeted discover did not return in `candidates`.

## 2. Find repos

They confirmed they understand, so list the flow-next product repos that already have `.flow/`.

Do not clone. Do not call GitHub hook APIs. Do not write Actions secrets or workflow files. Fleet discover is only this beat:

```bash
bun factory/discover.ts
```

Optional: `--owner <login>`.

Stdout is JSON: `{ "candidates": ["owner/name", ...], "named_without_flow": [...] }`. Exit 20 is fail-closed (incomplete scan). Do not treat a partial or empty-on-error list as “the candidates.” Show the stderr reason and stop.

Empty `candidates`: show the empty set. Wait for a named repo or stop. Do not invent a confirm set. A later named repo uses the same targeted discover as no-confirm (`bun factory/discover.ts --named owner/name --whitelist owner/name`), not a silent fleet re-scan.

## 3. You pick

They choose which repos get the factory.

If `named_without_flow` is non-empty, ask whether they intended that repo and whether to init flow-next (`/flow-next:setup`). Do not auto-init. Do not silently skip. Do not install. After they finish setup, re-run the same targeted discover (`--named` and `--whitelist` together) until the name is in `candidates`.

Present the candidate `owner/name` list. Wait for an explicit confirmation reply naming the set to install.

A confirm card may appear; conversation-only still works. Unconfirmed candidates never reach Action install or routine create.

## 4. Builder/webhook

One builder and one webhook routine wake every confirmed Action.

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

## 5. Paste two secrets

GitHub never returns secret values; the owner pastes them from the routine panel.

The install program is a skill→program boundary. Invoke it **only after that confirmation reply**, with the named confirmed subset of `candidates`. Never pass discover stdout / a `candidates` JSON object / `--candidates`. Never `bun factory/install.ts --confirmed` a name that discover did not return in `candidates`.

```bash
bun factory/install.ts --confirmed owner/name,owner/other
```

Supply routine URL and sender key in the environment (not git): `GROK_BOT_WEBHOOK_URL`, `GROK_BOT_SENDER_KEY`. Fail closed if either is missing.

Do not POST GitHub Settings hooks. Do not copy secrets between repos. Partial failure is reported (succeeded/failed repos); there is no automatic rollback. Re-run is idempotent (converge the Action file; secrets still owner-set).

## 6. Done

The fire path exists; ticks are fn-1 now.

After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success.

Stop. Do not recap.

## Do not

- Invoke install, secret writes, or routine create before confirm.
- Run fleet discover before they confirm they understand, or after no-confirm.
- Auto-init or skip a named repo that has no `.flow/`.
- Install a name that discover did not return in `candidates`.
- Put routine URL, sender key, tokens, PATs, sessions, or vault paths in git.
- Arm live repos as a side effect of implementing or reading this repo.
- Invent a Grok Bot REST client for agents/routines.
- Overwrite a product repo’s flow-next:setup pin.
- Mint a second webhook routine on re-run.
- Create Settings→Webhooks.
- Treat ADVANCED with a dirty or unpushed tree as quiet success.

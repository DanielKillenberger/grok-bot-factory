# grok-bot-factory

This repo ships the factory program: a deterministic wake gate, an isolated tick runner, and stuck/owner-gated notify. Grok Bot skills invoke that program; they are not a substitute for the gate.

Copy these steps. Easy-install is later and is not required. A dashboard is welcome later.

The **builder** Grok Bot owns the webhook routine and supervises. Product work happens in a documented flow-next host (`/loop` or `/goal` calling `/flow-next:pilot` or `/flow-next:land`), not in Grok Bot chat. The host CLI is instance-configurable (flag/env; default = a documented host already on the builder machine). The product review pin is the checkout’s `.flow/config.json` `review.backend` plus instruction-file routing — not the host CLI, and not a hardcoded review model.

## Queue

A spec or task is in the queue only when flow-next marks it **ready**. Drafts are ignored. Ready is the consent boundary. The supervisor does not promote.

The factory is any repo you push to. Not a named-repo allowlist.

## Wake (happy path)

1. In Grok Bot, create one routine with trigger type `webhook` on the **builder**. Copy the URL and sender key from the **routine panel**. Do not put them in git.
2. In each product repo: GitHub **Settings → Webhooks → Add webhook**.
   - Payload URL = the routine URL
   - Secret = the sender key from the panel
   - Events: **push** only
3. That is a GitHub repo hook POSTing to a Grok Bot routine. Do not build a factory HTTP listener as the wake.

The routine’s **first action** is exec of `factory/gate.sh` on the delivered GitHub push body — no model. If the routine panel cannot exec a command before a model, stop (do not start a model to run the gate).

On fire: if the gate is quiet, stay quiet. If it starts, the builder runs `factory/tick.sh` on an isolated worktree via the instance host CLI. Stay quiet unless a human decision is needed.

## Add a repo

Add the same GitHub webhook on the new `owner/name`, same routine URL. Do not freeze an allowlist.

## On fire (supervisor)

1. Exec `factory/gate.sh` on the push body. No model.
2. If none ready (exit 0): stop. No status ping.
3. If stuck (exit 20): notify `NEEDS_HUMAN` (builder → main → human). Preserve the reason.
4. If start (exit 10): new isolated worktree, run `factory/tick.sh` via the instance host CLI (flag/env; default = a documented host already on this machine). Review pin is the product checkout’s `.flow/config.json` `review.backend` plus instruction-file routing. Do not overwrite the pin. Do not infer the host from `review.backend`.
5. Cloud Agents only if that instance host CLI cannot run.

`/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`.

## Notify

Ping only when something needs a decision: `NEEDS_HUMAN`, `ASKED`, or an owner-gated act (send, pay, publish, merge). `DEFERRED_TO_LAND` is owner-gated merge. Dirty-tree / `BLOCKED` at tick start maps to `NEEDS_HUMAN`. Path: builder Grok Bot handoff to main; if main cannot resolve, a human. Main does not own the routine.

No “picked up”, no “still running”, no “PR opened”.

## Easy-install (later)

Not required. Manual wiring above is enough.

## Footnotes (not the path)

Cursor GitHub *listeners* have no raw git-push event (PR opened/pushed/merged only). A coarse cron is an optional fallback. Do not document a poll as the factory.

## Do not put in git

Routine URL, sender key, tokens, PATs, sessions, and vault paths. Those stay in the Grok Bot routine panel, GitHub webhook settings, and the instance vault — not this repo.

## Do not arm from this README

Creating the Grok Bot webhook routine is a separate yes. Implementing or reading this repo does not arm a production wake.

# grok-bot-factory

This repo ships the factory program: a deterministic wake gate, a coordinator skill that launches Cursor Cloud Agents, and stuck/owner-gated notify. Grok Bot skills invoke that program; they are not a substitute for the gate.

Copy these steps. Easy-install (send this repo to **main**) is optional; hand-wire below is enough. A dashboard is welcome later.

The **builder** Grok Bot owns the webhook routine and supervises. Product work happens in Cursor Cloud Agents launched by the coordinator skill, not in Grok Bot chat. The product review pin is the checkout’s `.flow/config.json` `review.backend` plus instruction-file routing — not a hardcoded review model.

## Queue

A spec or task is in the queue only when flow-next marks it **ready**. Drafts are ignored. Ready is the consent boundary. The supervisor does not promote.

The factory is any repo you push to. Not a named-repo allowlist.

## Wake (happy path)

1. In Grok Bot, create one routine with trigger type `webhook` on the **builder**. Copy the URL and sender key from the **routine panel**. Do not put them in git.
2. In each product repo: copy `.github/workflows/factory-forward.yml` from this repo, then set Actions secrets `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` (owner paste from the panel). GitHub never returns secret values. Native Settings webhooks cannot send `Authorization: Bearer` and are not the fire path.
3. On push, the Action POSTs the event payload to the one builder webhook with Bearer and `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. Cursor may drop the body; the gate recovers identity from that User-Agent (or a real push body if present).

The factory program is TypeScript on Bun. The routine’s **first action** is exec of `factory/gate.ts` — no model (`bun factory/gate.ts`, or the file shebang). If the routine panel cannot exec a command before a model, stop (do not start a model to run the gate).

On fire: if the gate is quiet, stay quiet. If it starts, the builder enables the coordinator skill, which launches Cursor Cloud Agents. Stay quiet unless a human decision is needed.

## Add a repo

Install the same factory-forward Action and the two secrets on the new `owner/name`, same routine URL. Do not freeze an allowlist.

## On fire (supervisor)

1. Exec `factory/gate.ts` on the wake (push body or Cursor envelope). No model.
2. If none ready (exit 0): stop. No status ping.
3. If stuck (exit 20): notify `NEEDS_HUMAN` (builder → main → human). Preserve the reason.
4. If start (exit 10): enable the coordinator skill (`skills/factory-coordinator/SKILL.md`), which launches Cursor Cloud Agents for named build jobs. The factory does not call `/land`. The coordinator merges. Review pin is the product checkout’s `.flow/config.json` `review.backend` plus instruction-file routing. Do not overwrite the pin.

## Notify

Ping only when something needs a decision: `NEEDS_HUMAN`, `ASKED`, or an owner-gated act (send, pay, publish, merge). `DEFERRED_TO_LAND` is owner-gated merge. Dirty-tree / `BLOCKED` at tick start maps to `NEEDS_HUMAN`. Path: builder Grok Bot handoff to main; if main cannot resolve, a human. Main does not own the routine.

No “picked up”, no “still running”, no “PR opened”.

## Easy-install

Send this repo to your **main** Grok Bot agent. Easy-install is optional and not required; hand-wire (Wake) remains valid. Each beat is one short why, then the action.

1. **Orient** — This factory only works with flow-next (product repos with `.flow/` specs). Confirm you understand before anyone lists repos. If you do not: say where to apply it and whether to install flow-next (`/flow-next:setup`). Do not auto-init. Do not fleet-discover.
2. **Find repos** — Confirmed owners get a list of flow-next product repos. Run `bun factory/discover.ts`. Empty list: wait for a named repo or stop.
3. **You pick** — You choose the set. Named repo without `.flow/`: ask intent and whether `/flow-next:setup`; never auto-init, never silent skip. Wait for an explicit confirmation reply naming the set.
4. **Builder/webhook** — One builder, one webhook for all Actions. Assign an existing builder; create one only if none exists. Do not mint a second routine.
5. **Paste two secrets** — GitHub never shows secret values. Paste `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` from the routine panel, then install the factory-forward Action on the confirmed set. Not Settings hooks.
6. **Done** — The fire path exists; start is enable the coordinator skill, which launches Cursor Cloud Agents. After every factory tick, if the tree moved, commit (if needed) and push to the spec branch. ADVANCED with a dirty or unpushed tree is a fail, not quiet success. Stop. Do not recap.

Main supervises setup only. The routine’s first action is still `bun factory/gate.ts` (no model). Then enable the coordinator skill, which launches Cursor Cloud Agents. Confirm the Grok Bot native Cloud Agent capability (team toggle that Bots can launch Cursor cloud agents) is on. Do not paste a Cloud Agent API key. Do not overwrite a product repo’s flow-next:setup review pin.

Later-proof (document now, run after the skill ships). Same-account: a second main on the same account, throwaway product repo, shared computer and GitHub, no second login. Do not arm live factory-wake. Never reuse the live factory builder, the live factory-wake webhook, or live secrets.

- **No-builder:** create a new builder + webhook. Live teammates do not count as an existing builder.
- **Existing-builder:** reuse a designated test builder only; do not create a third; never the live factory builder.

## Footnotes (not the path)

Cursor GitHub *listeners* have no raw git-push event (PR opened/pushed/merged only). A coarse cron is an optional fallback. Do not document a poll as the factory.

## Do not put in git

Routine URL, sender key, tokens, PATs, sessions, and vault paths. Those stay in the Grok Bot routine panel, GitHub Actions secrets, and the instance vault — not this repo.

## Tests

```bash
bun test
```

## Do not arm from this README

Creating the Grok Bot webhook routine is a separate yes. Implementing or reading this repo does not arm a production wake.

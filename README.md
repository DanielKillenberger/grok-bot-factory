# grok-bot-factory

Public runbook. Copy these steps. The factory is a runbook plus the Grok Bot supervisor. A dashboard is welcome later.

Grok Bot coordinates. Building happens in `grok` + `cursor-agent`. The host is `/loop` or `/goal`. That host calls `/flow-next:pilot` once per tick. Grok Bot is not the loop. The supervisor is not the tick. Do not implement in Grok Bot chat.

## Queue

A spec or task is in the queue only when flow-next marks it **ready**. Drafts are ignored. Ready is the consent boundary. The supervisor does not promote.

The factory is any repo you push to. Not a named-repo allowlist.

## Wake (happy path)

1. In Grok Bot, create one routine with trigger type `webhook`. Copy the URL and sender key from the **routine panel**. Do not put them in git.
2. In each product repo: GitHub **Settings → Webhooks → Add webhook**.
   - Payload URL = the routine URL
   - Secret = the sender key from the panel
   - Events: **push** only
3. That is a GitHub repo hook POSTing to a Grok Bot routine. Do not build a factory HTTP listener as the wake.

On fire: the routine looks for **ready** specs/tasks only (via `gh`, no clone). If none, stay quiet. If one is sitting, the supervisor starts `/loop` or `/goal` on a checkout. Stay quiet unless a human decision is needed.

## Add a repo

Add the same GitHub webhook on the new `owner/name`, same routine URL. Do not freeze an allowlist.

## On fire (supervisor)

1. Check ready specs/tasks only. Skip drafts.
2. If none: stop. No status ping.
3. If one is sitting: checkout if needed, start `/loop` or `/goal` (review pin: `cursor:gpt-5.6-sol-high`). Never bare `agent`.
4. Implementer: `grok` (grok-4.6). Reviewer: Cursor Sol. Never both local and cloud.
5. Cloud Agents only if the CLIs cannot. Then two CloudAgents: implementer grok-4.6, reviewer gpt-5.6-sol.

`/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`.

## Notify

Ping the owner only when something needs a decision: `NEEDS_HUMAN`, `ASKED`, or an owner-gated act (send, pay, publish, merge). Otherwise just ship. No “picked up”, no “still running”, no “PR opened”.

## Footnotes (not the path)

Cursor GitHub *listeners* have no raw git-push event (PR opened/pushed/merged only). A coarse cron is an optional fallback. Do not document a poll as the factory.

## Do not put in git

Routine URL, sender key, tokens, PATs, sessions. Those stay in the Grok Bot routine panel and GitHub webhook settings.

## Do not arm from this README

Creating the Grok Bot webhook routine is a separate yes. This repo is the runbook only.

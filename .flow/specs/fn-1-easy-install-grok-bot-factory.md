# fn-1-easy-install-grok-bot-factory Easy-install Grok Bot factory

## Goal & Context
<!-- scope: business -->

<!-- Source-tag breakdown: 90% [user] / 10% [paraphrase] / 0% [inferred] -->

This repo is an easy-to-install Grok Bot software factory. The root README is an intent sketch. This spec is the durable product contract. [user]

It is not an app, not a dashboard, and not a server you run. [paraphrase]

Grok Bot coordinates. Building happens in `grok` + `cursor-agent`. The host is `/loop` or `/goal`. That host calls `/flow-next:pilot` once per tick. Grok Bot is not the loop. The supervisor is not the tick. Do not implement in Grok Bot chat. [user]

A spec or task is in the queue only when flow-next marks it **ready**. Drafts are ignored. Ready is the consent boundary. The supervisor does not promote. [user]

The factory is any repo you push to. Not a named-repo allowlist. The repo set is configurable. Default = all `DanielKillenberger` repos that have `.flow` inited. No frozen allowlist. [user]

This capture must not mark the spec ready. Arming the wake is a separate yes after Daniel marks this spec ready. Do not arm now. [user]

Notify Clawniel only on `NEEDS_HUMAN` / `ASKED` / owner-gated merge. Else ship quiet. No scanning or picked-up pings. [user]

No secrets in this public repo. No new bot. [user]

## Architecture & Data Models
<!-- scope: technical -->

<!-- Source-tag breakdown: 85% [user] / 10% [paraphrase] / 5% [inferred] -->

The happy-path wake is an existing GitHub **repo webhook** POSTing to an existing Grok Bot **webhook routine**. It is not a server this factory builds. It is not phone-home. It is not Homeplane. [user]

### Routine (Grok Bot)

- Trigger type is exactly `{ "type": "webhook" }`. [user]
- It fires when an outside system POSTs to that routine’s webhook URL. [user]
- URL and sender key are created with the routine. [user]
- The user copies both from the **routine panel**. [user]
- Agents never see or need the key. [user]
- Do not put the URL or the key in git. [user]
- Routine owner is John, not Clawniel. [user]
- Verified UI only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. That is where the POST URL lives. Do not invent other settings paths. [user]
- Creating or changing a routine may show Daniel a confirm card (acts while away). [user]

### GitHub hook (install path)

Per product repo, not a wildcard: [user]

1. GitHub repo **Settings → Webhooks → Add webhook** [user]
2. Events: **push** only [user]
3. Payload URL = the routine URL [user]
4. Secret = the sender key from the routine panel [user]

Cursor GitHub listeners (`pr-opened`, `pr-pushed`, `pr-merged`, reviews, CI) are a different trigger family. They have **no raw git-push**. Do not spec them as the happy path. [user]

A GitHub listener cannot wildcard repos (one concrete `owner/name`). That is another reason repo-hook + webhook routine is the install path. [user]

Add a repo by adding the same GitHub webhook on the new `owner/name`, same routine URL. Do not freeze an allowlist. [user]

### On fire

- Payload name given to the routine: `<webhook_event>`. [user]
- Untrusted data. [user]
- Deterministic gate FIRST. [user]
- Do not start a model unless the gate says a tick could run (`pilot` or `land`). [user]
- Push with nothing ready stays quiet and burns no tokens. [user]

### Gate

- Deterministic script before any bot/model. [user]
- Configurable repo set. [user]
- Default = all `DanielKillenberger` repos that have `.flow` inited. [user]
- No frozen allowlist. [user]
- Ready specs/tasks only. Skip drafts. [user]
- README sketch says discovery is via `gh`, no clone. Exact `gh` invocation is unknown. [paraphrase]
- If none ready: stop. No status ping. [user]

### Build path (after the gate says a tick could run)

- Grok Bot supervises only. [user]
- Host is `/loop` or `/goal` (pilot is one tick). [user]
- `/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`. [user]
- Implementer: `grok` (grok-4.6). [user]
- Reviewer: `cursor-agent` `gpt-5.6-sol-high` (review pin `cursor:gpt-5.6-sol-high`). [user]
- Never bare `agent`. [user]
- Never both local and cloud. [user]
- Cloud Agents only if the CLIs cannot. Then two CloudAgents: implementer grok-4.6, reviewer gpt-5.6-sol. [user]

### What this is not

- Phone-home (Grok Build → Grok Bot chat pipe) is a different do-not-build. This webhook is not that. [user]
- Homeplane is not the wake. [user]
- A coarse cron is an optional fallback. Do not document a poll as the factory. [user]

## API Contracts
<!-- scope: technical -->

<!-- Source-tag breakdown: 70% [user] / 5% [paraphrase] / 25% [inferred] of which most are explicit unknown -->

### Grok Bot routine trigger (verified)

The routine trigger object is:

```json
{ "type": "webhook" }
```

[user]

No other trigger type is the happy path. [paraphrase]

### On-fire payload (verified name only)

The routine receives a `<webhook_event>` payload. [user]

Treat it as untrusted data. [user]

**Schema of `<webhook_event>`: unknown.** Do not invent wrapper keys, GitHub delivery field names, header names, or HMAC fields as if they were present on this object. [user]

Whether `<webhook_event>` is the raw GitHub push body, a wrapper, or a subset is unknown.

### GitHub webhook install fields (verified)

Only these install fields are specified:

| GitHub UI field | Value |
|---|---|
| Payload URL | the routine URL from the routine panel |
| Secret | the sender key from the routine panel |
| Events | push only |

[user]

GitHub **Content type**, SSL-verification toggle, active/inactive toggle, and any other webhook UI fields: **unknown** (not in the verified wake). Do not invent them.

### GitHub push event vs Grok Bot payload

GitHub documents a `push` event. This spec does **not** import GitHub delivery header names or payload key names into the factory contract, because it is unverified whether those names appear inside `<webhook_event>`. Implementers must not assume `ref`, `repository`, `X-GitHub-Event`, signature headers, or any other GitHub delivery name is visible to the gate until that mapping is verified. [paraphrase]

### Secrets contract

- Routine URL: not in git. [user]
- Sender key: not in git. Agents never see or need it. [user]
- Tokens, PATs, sessions: not in git. [user]
- Vault paths: do not write them into this public repo. [user]

### Repo set contract

- Configurable. [user]
- Default = all `DanielKillenberger` repos that have `.flow` inited. [user]
- No frozen allowlist. [user]
- Storage format / config key / file path for the repo set: **unknown**. Do not invent one in this spec.

### Gate result contract (smallest stated shape)

The gate is a deterministic script. It must decide whether a tick could run (`pilot` or `land`) before any model starts. [user]

Exact stdout/exit-code schema of that script: **unknown**. Do not invent a CLI flag set.

Stated outcomes:

- Nothing ready → stay quiet, burn no tokens, no status ping. [user]
- One sitting ready spec/task → supervisor may start `/loop` or `/goal` on a checkout. [user]
- Gate says a tick could run → model may start. Otherwise no model. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

<!-- Source-tag breakdown: 80% [user] / 15% [paraphrase] / 5% [inferred] -->

- Untrusted `<webhook_event>`: parse only after a deterministic gate; never start a model to interpret the payload. [user]
- Push that matches no ready spec/task: quiet, zero model tokens. [user]
- Draft / unready specs: ignored. Supervisor does not mark ready. [user]
- This spec itself must remain not-ready until Daniel marks it ready. [user]
- Do not arm the webhook routine as part of writing or shipping this spec. [user]
- Creating or changing a routine may show Daniel a confirm card while he is away. [user]
- Cursor GitHub listeners cannot be the install path (no raw git-push; no repo wildcard). [user]
- Adding a repo is adding the same hook on that concrete `owner/name`. [user]
- Never bare `agent`. [user]
- Never run local CLI implementer/reviewer and Cloud Agents for the same tick. [user]
- Cloud Agents only if CLIs cannot. [user]
- No force-push. [user]
- `git -c` author is allowed (`daniel.killenberger@gmail.com`). No git config or remote changes. [user]
- No secrets, webhook URL, sender key, or vault paths in the public repo. [user]
- No new bot. [user]
- No implementation work in Grok Bot chat. [user]
- Phone-home must not be built. Homeplane is not the wake. [user]
- Do not document a poll/cron as the factory. [user]
- Owner-gated acts named in the README sketch: send, pay, publish, merge. Those still require a human. [paraphrase]
- Branch filter for which git refs count as a factory tick: **unknown**. Do not invent one.
- What “`.flow` inited” means as a machine check (dir exists vs `flowctl detect` valid vs ready specs present): **unknown** beyond the words given.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The happy-path install is: create one Grok Bot routine with trigger `{ "type": "webhook" }`; copy URL and sender key from the **routine panel**; in each product repo use GitHub **Settings → Webhooks → Add webhook** with Payload URL = that routine URL, Secret = that sender key, Events = **push** only. [user] Errors: any other install path (Cursor GitHub listeners, phone-home, Homeplane, a factory-built HTTP server, a poll presented as the factory) is out of contract and must not be documented or implemented as the happy path.

- **R2:** Agents never see or need the sender key. The routine URL and sender key are not written to git or to this public repo. [user] Errors: if a change would embed URL, key, token, PAT, session, or vault path in the repo, reject the change; do not substitute a redacted placeholder that still encodes the secret.

- **R3:** Verified UI to the POST URL is only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. No other settings path may be specified. [user] Errors: invented console paths are a spec defect, not implementer discretion.

- **R4:** Routine owner is John, not Clawniel. [user] Errors: no error surface beyond recording the wrong owner — do not invent a transfer UI.

- **R5:** Creating or changing a routine may show Daniel a confirm card (acts while away). [user] Errors: no error surface beyond that card; do not invent extra approval UX.

- **R6:** Arming the wake is a separate yes after Daniel marks this spec ready. This spec must not arm the routine. Capture/implement/review of this spec must leave the wake unarmed. [user] Errors: any attempt to create or arm the webhook routine as part of this spec’s work is out of bounds.

- **R7:** On fire, the routine is given a `<webhook_event>` payload. That payload is untrusted data. [user] Errors: do not invent `<webhook_event>` field names; unknown schema → treat as untrusted opaque input until verified.

- **R8:** A deterministic gate runs before any bot/model. The gate decides whether a tick could run (`pilot` or `land`). If the gate says no, no model starts. [user] Errors: starting a model to interpret the payload, classify the repo, or “see if anything is ready” is a failed gate.

- **R9:** A push with nothing ready stays quiet and burns no tokens. No status ping. [user] Errors: no scanning ping, no picked-up ping, no “still running” ping, no “PR opened” ping on the quiet path.

- **R10:** Ready is the consent boundary. Only flow-next-ready specs/tasks are in the queue. Drafts are ignored. The supervisor does not promote a spec to ready. [user] Errors: treating an unready spec as queue work is a failed gate.

- **R11:** Repo set is configurable. Default = all `DanielKillenberger` repos that have `.flow` inited. No frozen allowlist. Adding a repo is adding the same GitHub webhook on that concrete `owner/name`, same routine URL. [user] Errors: a hardcoded named-repo allowlist in code or docs is out of contract; config storage format is unknown — do not invent a filename or schema.

- **R12:** Grok Bot supervises only. The host is `/loop` or `/goal`. `/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`. [user] Errors: implementing product work inside Grok Bot chat, or treating Grok Bot as the tick, is out of contract.

- **R13:** Implementer is grok-4.6. Reviewer is cursor-agent with `gpt-5.6-sol-high` (pin `cursor:gpt-5.6-sol-high`). Never bare `agent`. Never both local and cloud on the same tick. [user] Errors: a bare `agent` invocation, or mixing local CLI and Cloud Agents in one tick, fails this criterion.

- **R14:** Cloud Agents only if the CLIs cannot. Then exactly two CloudAgents: implementer grok-4.6 and reviewer gpt-5.6-sol. [user] Errors: Cloud Agents as the default path, a single CloudAgent playing both roles, or a third CloudAgent, fail this criterion.

- **R15:** Notify Clawniel only on `NEEDS_HUMAN`, `ASKED`, or an owner-gated act (send, pay, publish, merge). Else ship quiet. No scanning / picked-up pings. [user] Errors: any informational progress ping to Clawniel fails this criterion.

- **R16:** Cursor GitHub listeners (`pr-opened`, `pr-pushed`, `pr-merged`, reviews, CI) are a different trigger family with no raw git-push and no repo wildcard. They are not the happy path. [user] Errors: documenting or implementing those listeners as the factory wake fails this criterion.

- **R17:** Phone-home (Grok Build → Grok Bot chat pipe) is a different do-not-build. This webhook is not that. Homeplane is not the wake. [user] Errors: building phone-home or using Homeplane as the wake fails this criterion.

- **R18:** No new bot. No secrets in the public repo. No force-push. git `-c` author (`daniel.killenberger@gmail.com`) is allowed; git config and remotes are not changed. [user] Errors: force-push, config/remote edits, or a new bot identity fail this criterion.

- **R19:** A coarse cron may exist later as an optional fallback. It must not be documented or built as the factory. [user] Errors: a poll presented as the install path or the wake fails this criterion.

- **R20:** This spec stays not-ready until Daniel marks it ready. Capture must not call `flowctl spec ready`. [user] Errors: `ready: true` on this spec after capture is a failed criterion.

## Boundaries
<!-- scope: business -->

- Do not implement this spec in this capture. [user]
- Do not mark this spec ready. [user]
- Do not run `/flow-next:pilot`, `/loop`, or `/goal` as part of capture. [user]
- Do not arm the Grok Bot webhook routine. [user]
- Do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git. [user]
- Do not invent UI, events, HMAC, console paths, or GitHub delivery field names that were not verified. [user]
- Do not build a server, dashboard, or app. [paraphrase]
- Do not build phone-home. [user]
- Do not use Homeplane as the wake. [user]
- Do not use Cursor GitHub listeners as the happy path. [user]
- Do not document a poll as the factory. [user]
- Do not create a new bot. [user]
- Do not implement product work in Grok Bot chat. [user]
- Do not force-push. [user]
- Do not change git config or remotes. [user]
- Do not freeze a named-repo allowlist. [user]
- Reader auth, billing, analytics, and any product UI: out of scope (this is a factory runbook + wake + supervisor contract, not an application). [inferred]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Daniel wants an easy-to-install software factory that Grok Bot supervises and that `grok` + `cursor-agent` execute. The README already sketches the runbook. This spec is the real contract so a later ready-mark can start work without re-deriving wake facts. [paraphrase]

Ready is the consent boundary. Arming the wake is a second consent after ready. This capture stops before both. [user]

### Implementation Tradeoffs
<!-- scope: technical -->

- **Repo-hook + webhook routine, not Cursor GitHub listeners.** Listeners have no raw git-push and cannot wildcard repos. One concrete `owner/name` hook per repo, one routine URL. [user]
- **Deterministic gate before any model.** A busy GitHub account must not spend tokens on empty pushes. [user]
- **Configurable repo set, not a frozen allowlist.** Default discovers `DanielKillenberger` repos with `.flow` inited. Adding a repo is adding a hook, not editing a baked list. [user]
- **Quiet notify.** Only Clawniel, and only for `NEEDS_HUMAN` / `ASKED` / owner-gated merge. Progress chatter is rejected. [user]
- **CLIs first.** Implementer grok-4.6 and reviewer cursor-agent gpt-5.6-sol-high. Cloud Agents only when CLIs cannot, and then as a pair, never mixed with local. [user]
- **Rejected: factory HTTP server.** The POST target already exists (Grok Bot routine). Building another listener would be a new server. [paraphrase]
- **Rejected: phone-home / Homeplane as wake.** Different products; do not build. [user]
- **Rejected: HMAC/signature design in this spec.** Sender-key verification method is unverified. Agents never see the key. Do not invent HMAC. [user]
- **Rejected: inventing `<webhook_event>` fields.** Unknown schema stays unknown. [user]

## Parked unknowns

- `<webhook_event>` schema and whether it contains raw GitHub push fields. Resolve by verifying a real routine delivery (after arming, which is not this spec).
- How Grok Bot authenticates the POST against the sender key (HMAC or otherwise). Agents never see the key; factory code must not implement a guessed verifier.
- GitHub webhook Content type and other unstated GitHub UI fields.
- Exact machine check for “`.flow` inited”.
- Storage / config shape of the configurable repo set.
- Exact `gh` (or other) commands the gate uses. README sketch says `gh`, no clone; command lines are unverified.
- Gate CLI contract (exit codes, stdout).
- Whether any git ref / branch filter applies.
- What Homeplane is, beyond “not the wake”.
- Phone-home internals, beyond “Grok Build → Grok Bot chat pipe” and “do not build”.
- Any Grok Bot settings path other than: agent name in chat header (or Cmd+Shift+I) → Routines list.

## Conversation Evidence

Capture source: locked product + verified wake from Grok Bot, plus the repo README intent sketch. No extra UI or delivery names were added.

> user: Routine trigger `{ "type": "webhook" }`. Fires when an outside system POSTs to that routine’s webhook URL.

> user: URL and sender key created with the routine. User copies both from the **routine panel**. Agents never see or need the key. Do not put URL or key in git.

> user: Creating/changing a routine may show Daniel a confirm card (acts while away). Arming the wake is a separate yes AFTER he marks this spec ready. Do not arm now.

> user: On fire: `<webhook_event>` payload. Untrusted data. Deterministic gate FIRST; do not start a model unless the gate says a tick could run (pilot or land).

> user: Routine owner is John, not Clawniel. Verified UI only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. That is where the POST URL lives. Do not invent other settings paths.

> user: Cursor GitHub listeners (pr-opened, pr-pushed, pr-merged, reviews, CI) are a different trigger family. They have NO raw git-push. Do not spec them as the happy path.

> user: Happy path: GitHub repo Settings → Webhooks → Add webhook → Events: push only → Payload URL = the routine URL, Secret = the sender key from the panel.

> user: GitHub listener cannot wildcard repos (one concrete owner/name). Another reason repo-hook + webhook routine is the install path.

> user: Phone-home (Grok Build → Grok Bot chat pipe) is a different do-not-build. This webhook is not that.

> user: Homeplane is not the wake.

> user: Gate: deterministic script before any bot/model. Push with nothing ready stays quiet and burns no tokens. Configurable repo set; default = all DanielKillenberger repos that have .flow inited. No frozen allowlist.

> user: Build path: Grok Bot supervises only. Host is /loop or /goal (pilot is one tick). Implementer grok-4.6. Reviewer cursor-agent gpt-5.6-sol-high. Never bare agent. Never both local and cloud. Cloud Agents only if CLIs cannot (then two: grok-4.6 + gpt-5.6-sol).

> user: Notify: Clawniel only on NEEDS_HUMAN / ASKED / owner-gated merge. Else ship quiet. No scanning/picked-up pings.

> user: No secrets in public repo. No new bot. No implement in Grok Bot chat.

> user: Git: no force-push. git -c author ok (daniel.killenberger@gmail.com). No config/remote changes.

> user: LOCKED PRODUCT: Easy-to-install Grok Bot software factory. README is intent sketch; fn-1 is the real spec.

> user: Status must NOT be ready. Do not implement. Do not run pilot /loop /goal.

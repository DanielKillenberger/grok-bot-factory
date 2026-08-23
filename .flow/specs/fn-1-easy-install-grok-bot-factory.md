# fn-1-easy-install-grok-bot-factory Easy-install Grok Bot factory

## Goal & Context
<!-- scope: business -->

<!-- Source-tag breakdown: 90% [user] / 10% [paraphrase] / 0% [inferred] -->

This repo is an easy-to-install Grok Bot software factory. The root README is an intent sketch. This spec is the durable product contract. [user]

The factory is installable software plus the existing Grok Bot supervisor. A dashboard is welcome and in scope. It is not required for the first wake/install slice. Do not invent its screens in this spec. [user]

Grok Bot coordinates. Building happens on a host CLI that flow-next already documents. The installer and the product-repo `.flow/config.json` choose the host CLI and `review.backend`. Claude Code is a first-class path. Pinning grok + cursor-agent is one valid installer default (instance installer config may pin a host CLI + `review.backend`), not the product lock. The host is `/loop` or `/goal`. That host calls `/flow-next:pilot` once per tick. Grok Bot is not the loop. The supervisor is not the tick. Do not implement in Grok Bot chat. [user]

A spec or task is in the queue only when flow-next marks it **ready**. Drafts are ignored. Ready is the consent boundary. The instance owner marks specs ready. The supervisor does not promote. [user]

The factory is any repo you push to. Not a named-repo allowlist. The repo set is configurable. Default = all repos on the instance GitHub account that have `.flow` inited. No frozen allowlist. [user]

This capture must not mark the spec ready. Arming the wake is a separate yes after the instance owner marks this spec ready. Capture of this spec must leave `ready=false` (do not call `flowctl spec ready`). Do not arm now. [user]

Notify the instance notify target only on `NEEDS_HUMAN` / `ASKED` / owner-gated merge. Else ship quiet. No scanning or picked-up pings. [user]

No secrets in this public repo. No new bot. [user]

Product contract is generic. Instance identity (instance owner, instance GitHub account, supervising Grok Bot agent, instance notify target) lives in installer/instance config, not in this spec. Do not invent a config filename or schema for that identity. [user]

## Architecture & Data Models
<!-- scope: technical -->

<!-- Source-tag breakdown: 85% [user] / 10% [paraphrase] / 5% [inferred] -->

The happy-path wake is an existing GitHub **repo webhook** POSTing to an existing Grok Bot **webhook routine**. Do not build a factory HTTP listener as the happy-path wake. [user]

### Routine (Grok Bot)

- Trigger type is exactly `{ "type": "webhook" }`. [user]
- It fires when an outside system POSTs to that routine’s webhook URL. [user]
- URL and sender key are created with the routine. [user]
- The user copies both from the **routine panel**. [user]
- Agents never see or need the key. [user]
- Do not put the URL or the key in git. [user]
- Routine owner is the instance’s supervising Grok Bot agent (instance-configured), not the instance notify target. Not a named person in this spec. [user]
- Verified UI only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. That is where the POST URL lives. Do not invent other settings paths. [user]
- Creating or changing a routine may show the instance owner a confirm card (acts while away). [user]

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
- Default = all repos on the instance GitHub account that have `.flow` inited. [user]
- No frozen allowlist. [user]
- Ready specs/tasks only. Skip drafts. [user]
- README sketch says discovery is via `gh`, no clone. Exact `gh` invocation is unknown. [paraphrase]
- If none ready: stop. No status ping. [user]

### Build path (after the gate says a tick could run)

- Grok Bot supervises only. [user]
- Host is `/loop` or `/goal` (pilot is one tick). [user]
- `/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`. [user]
- Host CLI = whatever flow-next already documents (flow-next 4.5.1 `platforms.md` / README). Choosing Claude Code is valid. [user]
- Review backend = whatever flow-next already documents. Choosing `cursor:gpt-5.6-sol-high` is valid. Choosing another documented backend is valid. [user]
- Impl / review / sync routing uses flow-next’s existing `.flow/config.json` plus `flowctl spec set-backend` / `task set-backend` (`--impl`, `--review`, `--sync`). [user]
- Invoke the CLI the way flow-next documents for that platform. Do not invent a second driver. [user]
- A factory run that requires a CLI or backend flow-next does not document is a defect. A factory that refuses Claude Code or any other documented host is a defect. [user]

Documented host platforms (flow-next 4.5.1; do not invent extras): [user]

- Claude Code (canonical)
- OpenAI Codex (pre-built mirror)
- Factory Droid
- community OpenCode
- Grok Build (Claude Code compatibility)
- Cursor (via `.cursor-plugin` local install)

Documented review backends (flow-next 4.5.1; do not invent extras): [user]

- `rp` (RepoPrompt, macOS-only)
- `codex`
- `copilot`
- `cursor`
- `host`
- `none`

Grammar: `backend[:model[:effort]]` except `cursor` folds effort into the model (`cursor:gpt-5.6-sol-high`). [user]

Pinning grok + cursor-agent (review pin `cursor:gpt-5.6-sol-high`) is one valid installer default. Instance installer config may pin a host CLI + `review.backend`. It is not the product lock. [user]

Optional hygiene for an instance installer default (not a product defect for other installers): do not run local CLI and Cloud Agents for the same role on the same tick. [user]

### Wake fallbacks

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
- Default = all repos on the instance GitHub account that have `.flow` inited. [user]
- No frozen allowlist. [user]
- Storage format / config key / file path for the repo set: **unknown**. Do not invent one in this spec.

### Instance identity contract

- Instance owner = the person who installs. [user]
- Instance GitHub account = the installing user’s repos. [user]
- Supervising Grok Bot agent = instance-configured. [user]
- Instance notify target = instance-configured agent or human. [user]
- How those four are stored: **unknown**. Do not invent a config filename or schema. [user]

### Gate result contract (smallest stated shape)

The gate is a deterministic script. It must decide whether a tick could run (`pilot` or `land`) before any model starts. [user]

Exact stdout/exit-code schema of that script: **unknown**. Do not invent a CLI flag set.

Stated outcomes:

- Nothing ready → stay quiet, burn no tokens, no status ping. [user]
- One sitting ready spec/task → supervisor may start `/loop` or `/goal` on a checkout. [user]
- Gate says a tick could run → model may start. Otherwise no model. [user]

### Host CLI and review-backend contract (flow-next 4.5.1)

The factory uses whatever flow-next already supports. Do not invent a platform or backend. [user]

Host platforms (documented): Claude Code (canonical), OpenAI Codex (pre-built mirror), Factory Droid, community OpenCode, Grok Build (Claude Code compatibility), Cursor (via `.cursor-plugin` local install). [user]

Review backends (documented): `rp` (RepoPrompt, macOS-only), `codex`, `copilot`, `cursor`, `host`, `none`. [user]

Spec form: `backend[:model[:effort]]`. `cursor` folds effort into the model (`cursor:gpt-5.6-sol-high`). [user]

Routing surfaces that already exist (do not invent a new one): [user]

- product-repo `.flow/config.json` `review.backend`
- `flowctl spec set-backend` / `task set-backend` with `--impl`, `--review`, `--sync`

Instance installer config may pin grok + `cursor:gpt-5.6-sol-high`. Other documented hosts and backends remain valid. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

<!-- Source-tag breakdown: 80% [user] / 15% [paraphrase] / 5% [inferred] -->

- Untrusted `<webhook_event>`: parse only after a deterministic gate; never start a model to interpret the payload. [user]
- Push that matches no ready spec/task: quiet, zero model tokens. [user]
- Draft / unready specs: ignored. Supervisor does not mark ready. [user]
- This spec itself must remain not-ready until the instance owner marks it ready. Capture of this spec must leave `ready=false` (do not call `flowctl spec ready`). [user]
- Do not arm the webhook routine as part of writing or shipping this spec. [user]
- Creating or changing a routine may show the instance owner a confirm card while away. [user]
- Cursor GitHub listeners cannot be the install path (no raw git-push; no repo wildcard). [user]
- Adding a repo is adding the same hook on that concrete `owner/name`. [user]
- Invoke the host CLI the way flow-next documents for that platform. Do not invent a second driver. [user]
- Optional hygiene for an instance installer default, not a product defect: do not run local CLI and Cloud Agents for the same role on the same tick. [user]
- No force-push. [user]
- `git -c` author is allowed (git author is instance config, not this spec). No git config or remote changes. [user]
- No secrets, webhook URL, sender key, or vault paths in the public repo. [user]
- No new bot. [user]
- No implementation work in Grok Bot chat. [user]
- Do not document a poll/cron as the factory. [user]
- Owner-gated acts named in the README sketch: send, pay, publish, merge. Those still require a human. [paraphrase]
- Branch filter for which git refs count as a factory tick: **unknown**. Do not invent one.
- What “`.flow` inited” means as a machine check (dir exists vs `flowctl detect` valid vs ready specs present): **unknown** beyond the words given.
- HMAC / sender-key verification method: **unknown**. Stay parked. Do not invent HMAC. [user]
- `<webhook_event>` schema: **unknown**. Stay parked. [user]
- How instance owner / GitHub account / supervisor agent / notify target are stored: **unknown**. Stay parked. Do not invent a filename or schema. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The happy-path install is: create one Grok Bot routine with trigger `{ "type": "webhook" }`; copy URL and sender key from the **routine panel**; in each product repo use GitHub **Settings → Webhooks → Add webhook** with Payload URL = that routine URL, Secret = that sender key, Events = **push** only. [user] Errors: any other install path (Cursor GitHub listeners, a factory-built HTTP listener as the wake, a poll presented as the factory) is out of contract and must not be documented or implemented as the happy path.

- **R2:** Agents never see or need the sender key. The routine URL and sender key are not written to git or to this public repo. [user] Errors: if a change would embed URL, key, token, PAT, session, or vault path in the repo, reject the change; do not substitute a redacted placeholder that still encodes the secret.

- **R3:** Verified UI to the POST URL is only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. No other settings path may be specified. [user] Errors: invented console paths are a spec defect, not implementer discretion.

- **R4:** Routine owner is the instance’s supervising Grok Bot agent (instance-configured), not the instance notify target. Not a named person in this spec. [user] Errors: no error surface beyond recording the wrong owner — do not invent a transfer UI.

- **R5:** Creating or changing a routine may show the instance owner a confirm card (acts while away). [user] Errors: no error surface beyond that card; do not invent extra approval UX.

- **R6:** Arming the wake is a separate yes after the instance owner marks this spec ready. This spec must not arm the routine. Capture/implement/review of this spec must leave the wake unarmed. [user] Errors: any attempt to create or arm the webhook routine as part of this spec’s work is out of bounds.

- **R7:** On fire, the routine is given a `<webhook_event>` payload. That payload is untrusted data. [user] Errors: do not invent `<webhook_event>` field names; unknown schema → treat as untrusted opaque input until verified.

- **R8:** A deterministic gate runs before any bot/model. The gate decides whether a tick could run (`pilot` or `land`). If the gate says no, no model starts. [user] Errors: starting a model to interpret the payload, classify the repo, or “see if anything is ready” is a failed gate.

- **R9:** A push with nothing ready stays quiet and burns no tokens. No status ping. [user] Errors: no scanning ping, no picked-up ping, no “still running” ping, no “PR opened” ping on the quiet path.

- **R10:** Ready is the consent boundary. Only flow-next-ready specs/tasks are in the queue. Drafts are ignored. The instance owner marks specs ready. The supervisor does not promote a spec to ready. [user] Errors: treating an unready spec as queue work is a failed gate.

- **R11:** Repo set is configurable. Default = all repos on the instance GitHub account that have `.flow` inited. No frozen allowlist. Adding a repo is adding the same GitHub webhook on that concrete `owner/name`, same routine URL. [user] Errors: a hardcoded named-repo allowlist in code or docs is out of contract; config storage format is unknown — do not invent a filename or schema.

- **R12:** Grok Bot supervises only. The host is `/loop` or `/goal`. `/flow-next:pilot` is one tick. `/loop` or `/goal` calls it each tick until `NO_WORK`, `NEEDS_HUMAN`, or `DEFERRED_TO_LAND`. [user] Errors: implementing product work inside Grok Bot chat, or treating Grok Bot as the tick, is out of contract.

- **R13:** Host CLI is whatever flow-next already documents: Claude Code (canonical), OpenAI Codex (pre-built mirror), Factory Droid, community OpenCode, Grok Build (Claude Code compatibility), Cursor (via `.cursor-plugin` local install). Choosing Claude Code is valid. Pinning grok + cursor-agent is one valid installer default, not the product lock. [user] Errors: a factory that refuses Claude Code, or any other documented host, is a defect; treating an instance grok pin as the only legal host is a defect.

- **R14:** Review backend is whatever flow-next already documents: `rp` (RepoPrompt, macOS-only), `codex`, `copilot`, `cursor`, `host`, `none`, plus the documented spec form `backend[:model[:effort]]` (`cursor` folds effort into the model, e.g. `cursor:gpt-5.6-sol-high`). Choosing `cursor:gpt-5.6-sol-high` is valid. Choosing another documented backend is valid. [user] Errors: requiring a backend flow-next does not document is a defect; treating `cursor:gpt-5.6-sol-high` as the only legal review pin is a defect.

- **R15:** Notify the instance notify target only on `NEEDS_HUMAN`, `ASKED`, or an owner-gated act (send, pay, publish, merge). Else ship quiet. No scanning / picked-up pings. [user] Errors: any informational progress ping to the instance notify target fails this criterion.

- **R16:** Cursor GitHub listeners (`pr-opened`, `pr-pushed`, `pr-merged`, reviews, CI) are a different trigger family with no raw git-push and no repo wildcard. They are not the happy path. [user] Errors: documenting or implementing those listeners as the factory wake fails this criterion.

- **R18:** No new bot. No secrets in the public repo. No force-push. git `-c` author is allowed (git author is instance config, not this spec); git config and remotes are not changed. [user] Errors: force-push, config/remote edits, or a new bot identity fail this criterion.

- **R19:** A coarse cron may exist later as an optional fallback. It must not be documented or built as the factory. [user] Errors: a poll presented as the install path or the wake fails this criterion.

- **R20:** This spec stays not-ready until the instance owner marks it ready. Capture must not call `flowctl spec ready`. [user] Errors: `ready: true` on this spec after capture is a failed criterion.

- **R21:** Impl / review / sync routing uses flow-next’s existing surfaces: product-repo `.flow/config.json` (`review.backend`) and `flowctl spec set-backend` / `task set-backend` (`--impl`, `--review`, `--sync`). [user] Errors: inventing a second routing mechanism, config key, or driver outside those surfaces fails this criterion.

- **R22:** A factory run that requires a host CLI or review backend flow-next does not document is a defect. [user] Errors: introducing an undocumented platform, backend name, or HMAC/verifier story as if it were in the flow-next 4.5.1 contract fails this criterion.

- **R23:** Invoke the host CLI the way flow-next documents for that platform. Do not invent a second driver. [user] Errors: a factory-invented wrapper, a bare undocumented binary name, or a second driver that is not the documented invocation for the chosen platform fails this criterion.

- **R24:** A dashboard is in scope and welcome. First slice may ship without one. Forbidding a dashboard, or treating "not a dashboard" as product identity, is a defect. Inventing dashboard screens, auth, or telemetry in this spec is a defect. [user] Errors: forbidding a dashboard, treating "not a dashboard" as product identity, or inventing dashboard screens/auth/telemetry in this spec fails this criterion.

## Boundaries
<!-- scope: business -->

- Do not implement this spec in this capture. [user]
- Do not mark this spec ready. [user]
- Do not run `/flow-next:pilot`, `/loop`, or `/goal` as part of capture. [user]
- Do not arm the Grok Bot webhook routine. [user]
- Do not put routine URL, sender key, tokens, PATs, sessions, or vault paths in git. [user]
- Do not invent UI, events, HMAC, console paths, or GitHub delivery field names that were not verified. [user]
- Do not invent a platform or review backend that flow-next 4.5.1 does not document. [user]
- Do not treat grok / cursor-agent / grok-4.6 / gpt-5.6-sol-high as the product lock. [user]
- Do not refuse Claude Code or any other documented host. [user]
- Do not build a factory HTTP listener as the happy-path wake. The wake is a GitHub repo hook POSTing to a Grok Bot webhook routine. [user]
- Do not use Cursor GitHub listeners as the happy path. [user]
- Do not document a poll as the factory. [user]
- Do not create a new bot. [user]
- Do not implement product work in Grok Bot chat. [user]
- Do not force-push. [user]
- Do not change git config or remotes. [user]
- Do not freeze a named-repo allowlist. [user]
- Do not add premature implementation tasks that invent script paths. [user]
- Do not invent dashboard screens, auth, billing, analytics, widgets, or a stack in this spec. Those stay parked. [user]
- Do not invent a config filename or schema for instance identity (instance owner, instance GitHub account, supervising Grok Bot agent, instance notify target). [user]
- Do not put instance-specific person or agent names in this product contract. [user]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

The product is an easy-to-install software factory that Grok Bot supervises and that a flow-next-supported host CLI executes. If someone wants Claude Code, they should be able to use it. The product is CLI/provider agnostic within what flow-next already documents. The README already sketches the runbook. This spec is the real contract so a later ready-mark can start work without re-deriving wake facts or re-pinning a vendor. Instance identity is not part of the product contract. [paraphrase]

Ready is the consent boundary. The instance owner marks specs ready. The supervisor does not promote. Arming the wake is a second consent after ready. This capture stops before both and must leave `ready=false`. [user]

### Implementation Tradeoffs
<!-- scope: technical -->

- **Repo-hook + webhook routine, not Cursor GitHub listeners.** Listeners have no raw git-push and cannot wildcard repos. One concrete `owner/name` hook per repo, one routine URL. [user]
- **Deterministic gate before any model.** A busy GitHub account must not spend tokens on empty pushes. [user]
- **Configurable repo set, not a frozen allowlist.** Default discovers repos on the instance GitHub account with `.flow` inited. Adding a repo is adding a hook, not editing a baked list. [user]
- **Quiet notify.** Only the instance notify target, and only for `NEEDS_HUMAN` / `ASKED` / owner-gated merge. Progress chatter is rejected. [user]
- **Host and review are flow-next’s documented set.** Claude Code, Codex, Droid, OpenCode, Grok Build, and Cursor are valid hosts. `rp` / `codex` / `copilot` / `cursor` / `host` / `none` are valid review backends. Routing stays on `.flow/config.json` and `flowctl spec|task set-backend`. [user]
- **Instance installer config may pin a host CLI + `review.backend`.** grok + cursor-agent / `cursor:gpt-5.6-sol-high` may be what an installer writes. Other installers that choose another documented host or backend are in contract. [user]
- **Optional hygiene (instance installer default, not a product defect):** do not run local CLI and Cloud Agents for the same role on the same tick. Other installers are not defective for omitting that lock. [user]
- **Rejected: factory HTTP server as the wake POST target.** The POST target already exists (Grok Bot routine). Building another listener as the happy-path wake is out of contract. That is different from a dashboard. [paraphrase]
- **Dashboard is allowed and desirable.** First slice is still wake + gate + supervisor. Dashboard shape is parked unknown. Do not invent screens, auth, billing, analytics, widgets, or a stack here. [user]
- **Rejected: HMAC/signature design in this spec.** Sender-key verification method is unverified. Agents never see the key. Do not invent HMAC. [user]
- **Rejected: inventing `<webhook_event>` fields.** Unknown schema stays unknown. [user]
- **Rejected: pinning the product to grok / cursor-agent / grok-4.6 / gpt-5.6-sol-high.** That pin is one installer default. [user]
- **Rejected: inventing a platform, backend, or second driver** that flow-next 4.5.1 does not document. [user]
- **Rejected: baking instance identity into the product contract.** Instance owner, instance GitHub account, supervising Grok Bot agent, and instance notify target are instance config. Do not invent a filename or schema for them here. [user]

## Parked unknowns

- `<webhook_event>` schema and whether it contains raw GitHub push fields. Resolve by verifying a real routine delivery (after arming, which is not this spec).
- How Grok Bot authenticates the POST against the sender key (HMAC or otherwise). Agents never see the key; factory code must not implement a guessed verifier.
- GitHub webhook Content type and other unstated GitHub UI fields.
- Exact machine check for “`.flow` inited”.
- Storage / config shape of the configurable repo set.
- How instance owner / GitHub account / supervisor agent / notify target are stored. Do not invent a filename or schema.
- Exact `gh` (or other) commands the gate uses. README sketch says `gh`, no clone; command lines are unverified.
- Gate CLI contract (exit codes, stdout).
- Whether any git ref / branch filter applies.
- Dashboard stack (framework, host, where it runs). Unknown until a later slice.
- Dashboard auth. Unknown until a later slice.
- What a dashboard shows (queue, status, or anything else). Unknown until a later slice.
- Any Grok Bot settings path other than: agent name in chat header (or Cmd+Shift+I) → Routines list.

## Conversation Evidence

Capture source: locked product + verified wake from Grok Bot, plus the repo README intent sketch, plus the 23 Aug 2026 CLI/provider-agnostic rewrite, plus the 23 Aug 2026 dashboard-welcome lock and the lock to say what this product is (no other-product contrast), plus the 23 Aug 2026 lock that the product contract is generic and instance identity lives in installer/instance config. Host and review lists taken from flow-next 4.5.1 `platforms.md` / README / orchestration docs. No extra UI, delivery names, platforms, backends, HMAC story, dashboard screens, or instance-identity storage schema were added.

> user: The spec should be CLI/provider agnostic. If someone wants to use Claude Code they should be able to. Whatever flow-next already supports. (23 Aug 2026)

> user: Host platforms flow-next already documents: Claude Code (canonical), OpenAI Codex (pre-built mirror), Factory Droid, community OpenCode, Grok Build (Claude Code compatibility), Cursor (via .cursor-plugin local install). Review backends: rp / codex / copilot / cursor / host / none. Grammar backend[:model[:effort]] except cursor folds effort into the model (cursor:gpt-5.6-sol-high). Per-spec/task backends via flowctl spec set-backend / task set-backend (--impl, --review, --sync).

> user: The factory uses whatever flow-next already supports. Installer / repo .flow/config.json chooses the host CLI and review.backend. Claude Code is a first-class path. Pinning grok + cursor-agent is ONE valid installer default (instance installer config may pin a host CLI + review.backend), not the product lock.

> user: Routine trigger `{ "type": "webhook" }`. Fires when an outside system POSTs to that routine’s webhook URL.

> user: URL and sender key created with the routine. User copies both from the **routine panel**. Agents never see or need the key. Do not put URL or key in git.

> user: Creating/changing a routine may show the instance owner a confirm card (acts while away). Arming the wake is a separate yes AFTER the instance owner marks this spec ready. Do not arm now.

> user: On fire: `<webhook_event>` payload. Untrusted data. Deterministic gate FIRST; do not start a model unless the gate says a tick could run (pilot or land).

> user: Routine owner is the instance’s supervising Grok Bot agent (instance-configured), not the instance notify target. Not a named person in this spec. Verified UI only: click the agent name in the chat header (or Cmd+Shift+I) → Routines list. That is where the POST URL lives. Do not invent other settings paths.

> user: Cursor GitHub listeners (pr-opened, pr-pushed, pr-merged, reviews, CI) are a different trigger family. They have NO raw git-push. Do not spec them as the happy path.

> user: Happy path: GitHub repo Settings → Webhooks → Add webhook → Events: push only → Payload URL = the routine URL, Secret = the sender key from the panel.

> user: GitHub listener cannot wildcard repos (one concrete owner/name). Another reason repo-hook + webhook routine is the install path.

> user: Gate: deterministic script before any bot/model. Push with nothing ready stays quiet and burns no tokens. Configurable repo set; default = all repos on the instance GitHub account that have .flow inited. No frozen allowlist.

> user: Build path: Grok Bot supervises only. Host is /loop or /goal (pilot is one tick). Host CLI and review backend are whatever flow-next already documents. Invoke the CLI the way flow-next documents for that platform; do not invent a second driver. Never-both-local-and-cloud is an instance operating lock / installer default, not a product defect.

> user: Notify: the instance notify target only on NEEDS_HUMAN / ASKED / owner-gated merge. Else ship quiet. No scanning/picked-up pings.

> user: No secrets in public repo. No new bot. No implement in Grok Bot chat.

> user: Git: no force-push. git -c author ok (git author is instance config, not this spec). No config/remote changes.

> user: i wouldn't say it isn't a dashboard. We could add a dashboard and that'd be pretty cool. (23 Aug 2026)

> user: Say what this product is. Do not name other repos/products to define it by negation. Wake = GitHub hook → Grok Bot webhook routine is enough. (23 Aug 2026)

> user: LOCKED PRODUCT: Easy-to-install Grok Bot software factory. README is intent sketch; fn-1 is the real spec. Product is not pinned to grok / cursor-agent / grok-4.6 / gpt-5.6-sol-high.

> user: Status must NOT be ready. Do not implement. Do not run pilot /loop /goal. Do not arm. Do not add premature implementation tasks that invent script paths. Do not create fn-2.

> user: The whole spec should be thought as a generic Grok Bot factory. Instance identity (instance owner, instance GitHub account, supervising Grok Bot agent, instance notify target) lives in installer/instance config, not in this spec or this repo’s product docs. Do not invent a config filename or schema for that identity. Capture must leave ready=false. (23 Aug 2026)

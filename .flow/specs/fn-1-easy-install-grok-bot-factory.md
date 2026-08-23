# fn-1-easy-install-grok-bot-factory Easy-install Grok Bot factory

## Goal & Context
<!-- scope: business -->

<!-- Source-tag breakdown: 90% [user] / 10% [paraphrase] -->

Build an easy-to-install Grok Bot software factory. [user]

The factory wakes on push notify. The repo set is configurable. The default is every DanielKillenberger repository that already has `.flow` inited. There is no frozen allowlist. [user]

Grok Bot supervises only. It notices ready specs/tasks and picks them up. Grok Bot is not the tick. The host is `/loop` or `/goal`. Pilot is one tick. [user]

Ready is the consent boundary. Drafts and open (not-ready) specs are ignored. The supervisor does not promote a spec to ready. John does not promote. [user]

The existing README stays as the intent sketch. This spec is the real contract. [user]

Creating the Grok Bot webhook routine is a separate yes. This spec names the wake path. It does not arm it. [user]

## Architecture & Data Models
<!-- scope: technical -->

<!-- Source-tag breakdown: 80% [user] / 20% [paraphrase] -->

Five surfaces, no new bot, no Homeplane, no phone-home product, no implement-in-Grok-Bot-chat path. [user]

1. **Wake.** A push notify reaches the supervisor. The repo set is configurable; default discovery is "DanielKillenberger repos that have `.flow` inited." Adding a repo is configuration/discovery, not a frozen list edit. [user]
2. **Pre-tick gate.** Before any bot or model runs, a deterministic script answers whether a tick could actually run (pilot or land). If no: stay quiet and burn no model tokens. If yes: start the harness. [user]
3. **Supervisor.** Grok Bot only. Notices ready specs/tasks and starts the host. Does not implement. Does not run the tick. Does not promote drafts. [user]
4. **Host + models.** Host is `/loop` or `/goal` (each tick is `/flow-next:pilot`). The main flow-next session may run in grok-build. Review backend is cursor-agent `gpt-5.6-sol-high`. Never a bare `agent`. Never both local and cloud in the same run. [user]
5. **Notify.** Clawniel only on `NEEDS_HUMAN`, `ASKED`, or an owner-gated merge. Everything else ships quiet. [user]

This repo is public. Secrets, webhook URL/key, vault paths, and PATs do not live here. [user]

## API Contracts
<!-- scope: technical -->

<!-- Source-tag breakdown: 70% [user] / 30% [paraphrase] -->

**Pre-tick gate (deterministic, no model).**

- Input: the configured repo set (default: DanielKillenberger repos with `.flow` inited) plus the question "could a tick actually run (pilot or land)?"
- Output: yes or no. No extra fields. [paraphrase]
- Yes means: at least one ready spec or ready task exists such that a host tick (`/loop` or `/goal` calling `/flow-next:pilot`) or a land tick could do work. [paraphrase]
- No means: stay quiet. Do not start a bot. Do not start a model. Do not ping. [user]
- The gate runs before any bot or model. A model that starts before this script has answered has broken this. [user]

**Supervisor pickup.**

- Looks only at flow-next **ready** specs/tasks. Drafts/open-not-ready are invisible. [user]
- If the gate said no: stop. No status ping. [user]
- If the gate said yes: start `/loop` or `/goal` on a checkout. Do not implement in Grok Bot chat. [user]

**Harness pin.**

- Main flow-next session may run in grok-build. [user]
- Review: cursor-agent `gpt-5.6-sol-high` (config value `cursor:gpt-5.6-sol-high`). [user]
- Forbidden: bare `agent`. Forbidden: local implementer plus cloud implementer in the same run. Forbidden: local reviewer plus cloud reviewer in the same run. [user]

**Notify.**

- Clawniel only when the outcome is `NEEDS_HUMAN`, `ASKED`, or an owner-gated merge. [user]
- Else: ship quiet. No "picked up", no "still running", no "PR opened". [user]

**Wake (specified, not armed).**

- Trigger type is push notify. [user]
- Routine URL and sender key stay out of git. They live in the Grok Bot routine panel and GitHub webhook settings. [user]
- Creating and arming that routine is a separate owner yes. This spec does not create it. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- No ready work → gate says no → quiet, zero model tokens. Errors: a model call on this path is a defect. [user]
- Draft / not-ready spec sitting on master → invisible to gate and supervisor. Errors: treating draft as ready, or promoting it, is a defect. [user]
- Repo without `.flow` inited → not in the default set. Errors: no error surface beyond exclusion. [paraphrase]
- Frozen allowlist of repo names → forbidden. The default is discovery, not a checked-in list. [user]
- Public repo leak → webhook URL, sender key, tokens, PATs, sessions, vault paths must never be committed. Errors: any of those in git is a defect. [user]
- Phone-home (Grok Build → Grok Bot chat pipe) → forbidden product. [user]
- Homeplane → forbidden. [user]
- New bot → forbidden. Use the existing Grok Bot as supervisor. [user]
- Implement in Grok Bot chat → forbidden. Building happens in `grok` + `cursor-agent` under `/loop` or `/goal`. [user]
- Bare `agent` → forbidden. [user]
- Both local and cloud for the same role in one run → forbidden. [user]
- Owner-gated acts (send, pay, publish, merge) still notify. Ordinary ship does not. [user]
- This spec work itself stays not-ready until Daniel marks it ready. Capture/plan must not flip ready. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The product is an easy-to-install Grok Bot software factory. Errors: shipping an app, dashboard, or always-on server as the product is a defect; the factory is installed software plus the existing Grok Bot supervisor. [user]
- **R2:** Wake is push notify. The repo set is configurable. Default membership is every DanielKillenberger repo that has `.flow` inited. Errors: a missing `.flow` excludes the repo (no error surface beyond exclusion); a repo that later inits `.flow` becomes eligible without a code change. [user]
- **R3:** There is no frozen allowlist of factory repos. Errors: a checked-in name list that must be edited to add a repo is a defect. [user]
- **R4:** Before any bot or model runs, a deterministic script decides whether a tick could actually run (pilot or land). Errors: starting a model or bot before this script answers is a defect. [user]
- **R5:** If the gate says no, the factory stays quiet and burns no model tokens. Errors: a status ping, a model call, or a harness start on the no-path is a defect. [user]
- **R6:** If the gate says yes, the harness starts (supervisor starts `/loop` or `/goal`). Errors: no error surface beyond host/harness start failure, which is `NEEDS_HUMAN`. [user]
- **R7:** The main flow-next session may run in grok-build. Errors: no error surface beyond R9/R10. [user]
- **R8:** Review backend is cursor-agent `gpt-5.6-sol-high` (`.flow/config.json` `review.backend` = `cursor:gpt-5.6-sol-high`). Errors: any other review pin on a factory run is a defect unless Daniel changes the pin. [user]
- **R9:** Never bare `agent`. Errors: a factory run that invokes bare `agent` is a defect. [user]
- **R10:** Never both local and cloud for the same role in one run. Errors: local+cloud implementer or local+cloud reviewer in one run is a defect. [user]
- **R11:** Grok Bot supervises only: notices ready specs/tasks and picks up. It is not the tick and does not implement. Errors: implementing in Grok Bot chat, or treating Grok Bot as `/flow-next:pilot`, is a defect. [user]
- **R12:** Host is `/loop` or `/goal`. `/flow-next:pilot` is one tick. Errors: a supervisor that is itself the tick loop is a defect. [user]
- **R13:** No secrets in this public repo (no webhook URL/key, no vault paths, no PATs, no tokens, no sessions). Errors: any of those committed is a defect. [user]
- **R14:** No phone-home product. Errors: a Grok Build → Grok Bot chat pipe, or any factory-to-chat telemetry product, is a defect. [user]
- **R15:** No implement in Grok Bot chat. Errors: same as R11 implement clause. [user]
- **R16:** No Homeplane. Errors: introducing Homeplane as a factory surface is a defect. [user]
- **R17:** No new bot. Errors: creating a second bot to run the factory is a defect. [user]
- **R18:** Notify path is Clawniel only on `NEEDS_HUMAN`, `ASKED`, or owner-gated merge. Errors: notifying on those events through a different path, or skipping them, is a defect. [user]
- **R19:** Else ship quiet. Errors: "picked up" / "still running" / "PR opened" pings are defects. [user]
- **R20:** This spec specifies the wake; it does not arm it. Creating the Grok Bot webhook routine is a separate yes. Errors: this spec's work creating or writing the routine URL/key is a defect. [user]
- **R21:** The existing README remains as the intent sketch. It is not deleted and is not treated as the spec. Errors: deleting or replacing README as the spec of record is a defect. [user]

## Boundaries
<!-- scope: business -->

- Creating or arming the Grok Bot webhook routine (separate owner yes). [user]
- Phone-home product. [user]
- Homeplane. [user]
- A new bot. [user]
- Implement in Grok Bot chat. [user]
- Frozen repo allowlist. [user]
- Secrets, webhook URL/key, vault paths, PATs in git. [user]
- Marking this spec ready (Daniel reviews first; John/supervisor do not promote). [user]
- Running `/flow-next:pilot`, `/loop`, or `/goal` as part of capturing this spec. [user]
- Plan-review of this spec (Daniel reviews the spec first). [user]

## Decision Context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Daniel locked this product 23 Aug 2026 21:37 via Clawniel. The factory exists so ready work in any DanielKillenberger `.flow` repo can be picked up on push without burning tokens on empty ticks and without chatting implementation through Grok Bot. [user]

### Implementation Tradeoffs
<!-- scope: technical -->

- **Discovery over allowlist.** Default = all DanielKillenberger repos with `.flow` inited. A frozen name list was rejected. [user]
- **Deterministic gate before any model.** Empty ticks stay free. [user]
- **Supervisor ≠ tick.** Grok Bot notices and starts `/loop` or `/goal`. Pilot remains one tick. [user]
- **One implementer family, one reviewer family.** grok-build may host the main session; review is cursor-agent `gpt-5.6-sol-high`. Never bare agent. Never local+cloud together. [user]
- **Quiet by default.** Clawniel only when a human must decide. [user]
- **Spec the wake, do not arm it.** Webhook routine is a separate yes so this public repo never holds the URL/key. [user]
- **README stays.** Intent sketch, not the spec of record. [user]
- Rejected: phone-home, Homeplane, new bot, implement-in-chat, treating this capture as a work tick. [user]

## Conversation Evidence

Locked product (Daniel 23 Aug 2026 21:37 via Clawniel), quoted:

- Easy-to-install Grok Bot software factory.
- Wake: push notify, configurable repo set. Default: all DanielKillenberger repos that have .flow inited. No frozen allowlist.
- Before ANY bot/model runs: a deterministic script decides if a tick could actually run (pilot or land). If no: stay quiet, burn no model tokens. If yes: start the harness.
- Main flow-next session may run in grok-build. Review backend: cursor-agent gpt-5.6-sol-high. Never bare agent. Never both local and cloud.
- Grok Bot supervises only. Notices ready specs/tasks and picks up. Not the tick. Host is /loop or /goal (pilot is one tick).
- No secrets in the public repo. No phone-home product. No implement in Grok Bot chat. No Homeplane. No new bot.
- Notify path: Clawniel only on NEEDS_HUMAN / ASKED / owner-gated merge. Else ship quiet.
- Creating the Grok Bot webhook routine is a separate yes (not this spec's arming). Spec the wake; do not arm it.
- Existing README stays as intent sketch.

Capture constraints (same session):

- SPEC ONLY. Do not implement. Do not mark ready. Do not run /flow-next:pilot, /loop, or /goal.
- Plan tasks if capture does not. Do NOT run plan-review (Daniel reviews the spec first).
- fn-1 slug like fn-1-easy-install-grok-bot-factory.

README (intent sketch, not the spec of record) already says: public runbook; not an app/dashboard/server; Grok Bot coordinates; building in grok + cursor-agent; ready is the consent boundary; supervisor does not promote; factory is any repo you push to; webhook URL/key stay out of git; ping only when a human decision is needed.

## Parked unknowns

- Exact on-disk layout of the installable factory (script names, package form) — not locked; plan tasks may name files, implementers must not treat those names as the spec contract.
- How the configurable repo set is stored (routine setting vs local config) — not locked; must remain not-a-frozen-allowlist (R3).
- Which host (`/loop` vs `/goal`) the supervisor starts when both exist — not locked; either is valid (R12).

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1 | Easy-to-install factory | fn-1-easy-install-grok-bot-factory.6 | — |
| R2 | Push-notify wake; configurable repo set; default DK + `.flow` | fn-1-easy-install-grok-bot-factory.2 | — |
| R3 | No frozen allowlist | fn-1-easy-install-grok-bot-factory.2 | — |
| R4 | Deterministic pre-tick gate before any bot/model | fn-1-easy-install-grok-bot-factory.1 | — |
| R5 | Gate no → quiet, no model tokens | fn-1-easy-install-grok-bot-factory.1 | — |
| R6 | Gate yes → start harness | fn-1-easy-install-grok-bot-factory.1 | — |
| R7 | Main session may run in grok-build | fn-1-easy-install-grok-bot-factory.4 | — |
| R8 | Review: cursor-agent gpt-5.6-sol-high | fn-1-easy-install-grok-bot-factory.4 | — |
| R9 | Never bare agent | fn-1-easy-install-grok-bot-factory.4 | — |
| R10 | Never both local and cloud | fn-1-easy-install-grok-bot-factory.4 | — |
| R11 | Grok Bot supervises only; ready pickup | fn-1-easy-install-grok-bot-factory.3 | — |
| R12 | Host is /loop or /goal; pilot is one tick | fn-1-easy-install-grok-bot-factory.3 | — |
| R13 | No secrets in the public repo | fn-1-easy-install-grok-bot-factory.6 | — |
| R14 | No phone-home product | fn-1-easy-install-grok-bot-factory.6 | — |
| R15 | No implement in Grok Bot chat | fn-1-easy-install-grok-bot-factory.3 | — |
| R16 | No Homeplane | fn-1-easy-install-grok-bot-factory.6 | — |
| R17 | No new bot | fn-1-easy-install-grok-bot-factory.6 | — |
| R18 | Clawniel only on NEEDS_HUMAN / ASKED / owner-gated merge | fn-1-easy-install-grok-bot-factory.5 | — |
| R19 | Else ship quiet | fn-1-easy-install-grok-bot-factory.5 | — |
| R20 | Spec the wake; do not arm it | fn-1-easy-install-grok-bot-factory.2 | — |
| R21 | README stays as intent sketch | fn-1-easy-install-grok-bot-factory.6 | — |

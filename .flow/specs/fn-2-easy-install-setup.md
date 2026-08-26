# fn-2-easy-install-setup Easy-install setup

## Overview

The owner sends this repo to their **main** Grok Bot agent. Main assigns (or creates) a builder, lists candidate repos, waits for confirm, then creates the builder’s webhook routine and installs the **factory-forward GitHub Action** on the confirmed set (workflow secrets from the routine panel). After that fire path exists, ticks are **fn-1**. This spec is work that factory can pick up once fn-1 runs from a hand-wired wake.

Discovery and Action install are **programs** in this repo (plus a conversation skill that drives them). Agent/routine create has no public Grok Bot REST, so that part is conversational — not a reason to skip code for `gh` discovery and GitHub Actions file/secrets REST.

Native GitHub Settings→Webhooks cannot wake Cursor/Grok Bot and are **not** the install path.

## Goal & Context
<!-- scope: business -->

Easy-install: send this repo to your **main** Grok Bot agent; it sets up the factory on the repos you confirm. [user]

Depends on **fn-1**. The factory must already run (hand-wired wake is enough). This spec is work that factory can pick up. [user]

Main supervises setup only. After the Action + one builder webhook routine exist, ticks are fn-1. [user]

No secrets land in git. That is a requirement, not out of scope. [user]

## Approach

Setup is a **conversation** with main, plus GitHub REST for the Action file and (owner-supplied) workflow secrets. There is **no public Grok Bot REST** to create an agent or a webhook routine (docs-scout, 2026). Agent/routine creation is conversational/UI; fail closed if routine URL and sender key cannot be obtained from the panel (or owner paste). Do not invent a Grok Bot API client.

Reuse fn-1’s single-repo `.flow/` probe. Discovery **lists** candidates (`gh repo list` paginated + Contents/`.flow/` or `gh repo read-dir`); the fire path in fn-1 still checks one repo only.

1. Assign an existing builder. Create one only if none exists (conversational). Re-runs reuse the same builder and routine — do not mint a second routine (duplicate wakes).
2. List candidates; wait for confirm. Default: instance GitHub account repos with `.flow/`, via `gh`, no clone. Paginate `gh repo list` (do not stop at the 30-repo default). Fail closed with a visible error on auth, 429, 5xx, network, malformed output, or a mid-scan probe failure — never present a silent partial list as complete. Whitelist fallback (instance config; no filename in this repo).
3. Named repo with no `.flow/`: ask intent and whether to init flow-next. No auto-init, no silent skip. If they want init, they (or main, with consent) run `/flow-next:setup` on that repo. Setup must **not** overwrite an existing pin (R6; flow-next setup already skips already-set `review.backend` and an existing routing block).
4. Confirm handoff (R3): the mutate program accepts **only** an explicit owner-confirmed `owner/name` list. The skill invokes it only after the confirmation reply. Unconfirmed candidates never reach Action install or routine create.
5. On confirm: create the builder webhook routine `{ "type": "webhook" }` if missing. That routine **reuses fn-1’s contract**: command-first exec of the gate program on a gate-valid GitHub push body (zero model tokens), then the coordinator/tick runner, with the instance host-CLI input. Fail closed if routine URL and sender key cannot be obtained (owner paste from the panel is allowed). Do not invent a Grok Bot REST client. One routine for all Actions. Do not mint a second routine.
6. Standing fire path (live e2e): a GitHub Action in each confirmed product repo POSTs `GITHUB_EVENT_PATH` to that **one** builder webhook with `Authorization: Bearer`. Native Settings webhooks cannot wake Cursor/Grok Bot — GitHub sends HMAC; Cursor wants `Authorization: Bearer <sender key>`; HMAC in the hook Secret field is ignored. Easy-install does **not** create Settings→Webhooks. [user]
7. Workflow secrets (never in git): `GROK_BOT_WEBHOOK_URL`, `GROK_BOT_SENDER_KEY`. Owner copies both from the Grok Bot routine panel. GitHub never returns secret values; setup cannot copy secrets from one repo to another. Fail closed if the owner cannot supply both. [user]
8. Identity: Cursor webhook wakes deliver `{headers, body_digest, timestamp_ms}`, not the POST body. Custom `X-Factory-*` headers are stripped. User-Agent survives. The Action MUST send `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. The wake materializes a gate-valid push JSON from that (or a real body if present). Fail closed if identity cannot be recovered. Never assume a single repo. [user] Identity recovery for the wake: a real GitHub push body if present, else the User-Agent factory-forward line, else fail-closed. Never assume a repo. [user] `X-Factory-*` is not a required recovery path — Cursor strips them; the Action may still send them but the factory must not need them. [user]
9. On confirm, install that Action on each confirmed repo (converge the workflow file) and require the two workflow secrets to be set (owner paste; Actions secrets API cannot read values back). Re-run is idempotent (converge the Action file; remind that secrets still cannot be proven by GET). Partial failure: no automatic rollback. Report what succeeded.
10. Deliverable is setup software. Do not arm live repos as a side effect of implementing or rewriting this spec.

Factory runtime (fn-1, already shipping — not this spec’s work): `ADVANCED` is quiet (next wake continues). `DEFERRED_TO_LAND` starts a land tick automatically (merge is not owner-gated). Ping only `NEEDS_HUMAN` or `ASKED`. [user]

Gate exits: 0 quiet / 10 start / 20 stuck. [user]

Merge is factory land. The owner still confirms ready on specs. [user]

Rejected as overkill: native Settings→Webhooks as the install fire path (HMAC Secret is ignored; Cursor wants Bearer); a new GitHub/git bot; auto-init of `.flow/`; dashboard; inventing instance-config filenames; inventing Grok Bot REST; minting a second routine; copying secrets between repos.

## Architecture & Data Models
<!-- scope: technical -->

1. Owner sends this repo to the main agent. [user]
2. Assign an existing builder; create one only if none exists. [user]
3. List candidates; owner confirms. Default discovery: `.flow/` on the instance GitHub account, via `gh`, no clone. Whitelist fallback. [user]
4. Named repo with no `.flow`: ask whether they meant it and whether to init flow-next. No auto-init, no silent skip. [user]
5. Create the builder’s webhook routine `{ "type": "webhook" }` if missing, and install the factory-forward Action on each confirmed repo (same one routine URL + Bearer sender key as workflow secrets). Do **not** create Settings→Webhooks. A confirm card may appear. [user]
6. Do not overwrite a repo’s flow-next:setup pin. [user]

POST URL UI (if someone needs to look): agent name in chat header (or Cmd+Shift+I) → Routines list. Owner copies URL and sender key from that panel into each repo’s Actions secrets. [user]

## API Contracts
<!-- scope: technical -->

Setup inputs: builder (assign / create-if-none), repos (discover-then-confirm or whitelist), named-repo-without-`.flow` ask, CLI location. Autonomy knob values are still parked — do not invent them this spec. [user]

Setup outputs: one webhook routine on the builder; factory-forward Action on confirmed repos; workflow secrets `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` set by the owner from the routine panel (not by copying between repos). [user]

Not the fire path: `POST /repos/{owner}/{repo}/hooks`. Native Settings webhooks send HMAC; Cursor wants `Authorization: Bearer`. HMAC in Secret is ignored.

Action identity contract: `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. Wake envelope is `{headers, body_digest, timestamp_ms}` (body not delivered). Materialize a gate-valid GitHub push JSON from User-Agent, or use a real push body if present. Fail closed if identity cannot be recovered. Never assume a single repo.

Identity recovery for the wake: a real GitHub push body if present, else the User-Agent factory-forward line, else fail-closed. Never assume a repo. `X-Factory-*` is not a required recovery path — Cursor strips them; the Action may still send them but the factory must not need them.

Gate exits: 0 quiet / 10 start / 20 stuck. Merge is factory land. The owner still confirms ready on specs.

Actions secrets: GitHub never returns secret values on GET. Setup cannot prove a secret matches, and cannot copy secrets repo-to-repo. Owner paste is the set path.

Storage filenames for instance inputs: unknown, instance config, not this git repo. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- Deliverable is setup software. Running it against live repos is a later owner yes. [user]
- Creating a Grok Bot builder agent when none exists is allowed. A new GitHub/git bot is not. [paraphrase]
- No public Grok Bot API for agents/routines: conversation/UI only; fail closed if URL+sender key cannot be obtained.
- Native Settings→Webhooks cannot wake Cursor/Grok Bot; installing them is not the fire path and does not satisfy R4.
- Incomplete discovery (default 30-repo cap, mid-scan failure) is an error, not a confirmable list.
- Partial setup: report; no automatic rollback; retry is idempotent (converge Action file; secrets still owner-set).
- GitHub never returns secret values; missing or unreadable secrets fail closed. Do not invent a copy-from-other-repo shortcut.
- Wake without recoverable identity (no User-Agent match and no real body) fails closed. Never assume a single repo.
- Identity recovery for the wake: a real GitHub push body if present, else the User-Agent factory-forward line, else fail-closed. Never assume a repo. `X-Factory-*` is not a required recovery path — Cursor strips them; the Action may still send them but the factory must not need them.
- Gate exits: 0 quiet / 10 start / 20 stuck.
- Merge is factory land. The owner still confirms ready on specs.

## Quick commands

```bash
# Discovery smoke (no Action install, no secrets writes): list .flow/ candidates via gh
# for a fixture owner, including a named repo without .flow/ that must prompt
# (not skip, not auto-init).
# Do not POST Settings hooks, do not write workflow secrets, and do not arm
# live repos as part of implementing this spec.
tests/factory/discover.test.sh
```

## Boundaries
<!-- scope: business -->

- Factory runtime is fn-1 (already shipping: `ADVANCED` quiet; `DEFERRED_TO_LAND` auto-lands; ping only `NEEDS_HUMAN` or `ASKED`). [user]
- Gate exits: 0 quiet / 10 start / 20 stuck. Merge is factory land. The owner still confirms ready on specs. [user]
- Do not arm live repos as a side effect of implementing or rewriting this spec. [user]
- Out of scope: dashboard, inventing payload field names, inventing instance-config filenames. [user]
- Out of scope: Settings→Webhooks as the install fire path; automatic rollback of a partial Action install; inventing a Grok Bot REST client; autonomy-knob values; copying secrets between repos.

## Decision context
<!-- scope: both -->

### Motivation
<!-- scope: business -->

Once the factory runs, setup should be “give this repo to my main agent.” [user]

### Implementation Tradeoffs
<!-- scope: technical -->

- Depends on fn-1. [user]
- Cut from ACs: routine-panel path, confirm-card, “don’t arm” — Boundaries or Architecture. [user]
- No secrets in git is in-scope (R7). Reject any change that would commit routine URL, sender key, tokens, PATs, sessions, or vault paths. [user]
- Agent/routine create is conversational because no public Grok Bot CRUD API exists (2026 docs). Action file install uses GitHub REST, which does exist. Secret *values* do not come back from GitHub and are owner-paste only.
- Native Settings→Webhooks were rejected as the fire path: GitHub HMAC ≠ Cursor `Authorization: Bearer`. Live e2e (2026-08-24/25) locked the Action + User-Agent path. [user]
- Partial-setup rollback is not built: idempotent retry + a success/fail report is enough.
- The easy-install routine is not a second factory. It must invoke fn-1’s gate command-first.
- fn-1 already ships automatic factory behavior (`ADVANCED` quiet; `DEFERRED_TO_LAND` starts land; ping only `NEEDS_HUMAN` or `ASKED`). Easy-install must not reintroduce owner-gated merge or progress pings.
- Gate exits stay 0 quiet / 10 start / 20 stuck. Merge is factory land; the owner still confirms ready on specs. Identity recovery is a real GitHub push body if present, else the User-Agent factory-forward line, else fail-closed — never assume a repo, and never require `X-Factory-*` (Cursor strips them; the Action may still send them).

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The owner can finish setup from a conversation with their main Grok Bot agent. Main supervises setup only. [user] Errors: UI-clicks-only as the only path fails this criterion.

- **R2:** Assign an existing builder by default. Create one only if none exists. [user] Errors: always creating a duplicate, or failing when none exists, fails this criterion.

- **R3:** Setup lists candidates and waits for confirm before adding the fire path. Default: discover `.flow/` repos via `gh`, no clone. Whitelist fallback. [user] Errors: Action/routine before confirm, or a frozen allowlist in this public repo, fail this criterion.

- **R4:** On confirm, create the builder’s webhook routine (one, reused) and install the factory-forward Action on each confirmed repo. Workflow secrets `GROK_BOT_WEBHOOK_URL` and `GROK_BOT_SENDER_KEY` are owner-copied from the routine panel; GitHub never returns secret values. Identity rides in `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`. Do **not** create Settings→Webhooks. [user] Errors: a Settings-webhook install path, minting a second routine, or a different wake family, fails this criterion.

- **R5:** If the owner named a repo with no `.flow`, ask whether they intended it and whether to init flow-next. [user] Errors: auto-init or silent skip of a named repo fails this criterion.

- **R6:** Do not overwrite a product repo’s flow-next:setup pin. [user] Errors: overwriting that pin fails this criterion.

- **R7:** Routine URL, sender key, tokens, PATs, sessions, and vault paths are not written to git. [user] Errors: reject any change that embeds them.

## Early proof point

Task fn-2-easy-install-setup.1 proves discover-then-confirm: complete candidate list (or a visible fail-closed error), confirm required, a named repo without `.flow/` asks (no auto-init, no silent skip), and the mutate program is not callable with an unconfirmed list. If that fails, do not install the Action or create a routine.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1  | Finish setup from a conversation with main | fn-2-easy-install-setup.1, fn-2-easy-install-setup.2 | — |
| R2  | Assign existing builder; create only if none | fn-2-easy-install-setup.2 | — |
| R3  | Discover-then-confirm; gh no clone; whitelist fallback | fn-2-easy-install-setup.1, fn-2-easy-install-setup.2 | — |
| R4  | On confirm: one builder webhook routine + factory-forward Action (not Settings hooks) | fn-2-easy-install-setup.2 | — |
| R5  | Named repo without `.flow/`: ask intent + init | fn-2-easy-install-setup.1 | — |
| R6  | Do not overwrite flow-next:setup pin | fn-2-easy-install-setup.2 | — |
| R7  | No secrets in git | fn-2-easy-install-setup.2 | — |

## Open questions

- Autonomy knob values (setup input in API Contracts) — parked; do not invent an enum this spec.
- Instance-config filenames — parked.
- How main obtains routine URL + sender key from the Grok Bot panel in conversation (owner paste is an acceptable fallback).
- How setup records “secrets were set” when GitHub never returns values (owner attestation vs. Actions secrets API existence-only).

## References

- GitHub Actions secrets: https://docs.github.com/en/rest/actions/secrets
- GitHub Contents API: https://docs.github.com/en/rest/repos/contents
- `gh repo list`: https://cli.github.com/manual/gh_repo_list
- Grok Bot create agent (UI): https://docs.x.ai/grok-bot/bots
- Grok Bot routines (UI, no public CRUD): https://docs.x.ai/grok-bot/skills-routines-and-automations
- flow-next setup Keep-mine for existing pins: plugin `skills/flow-next-setup/workflow.md`
- Standing Action template in this repo: `.github/workflows/factory-forward.yml` (hand-wire reference; easy-install converges a copy onto confirmed repos)

## Parked unknowns

- Autonomy knob values
- Instance-config filenames
- How the panel exposes routine URL + sender key to the agent (owner paste fallback)
- Existence-only vs value attestation for Actions secrets

## Conversation Evidence

> user: the first thing that needs built is a repo that you can send to whatever you call your main agent in grok bot and it'll just set it up for you.

> user: default is assign (Most who install this will have a builder) only if there is none will one be created

> user: discover-then-confirm

> user: setup agent should ask if the user intended that repo and if they want it to be setup with flow-next

> user: then we should do setup as fn-2

> user: looks good but check if we can't cut some reqs. Stuff like "we're not doing this" is often just superfluous.

> user: fn-2 looks like a fine amount of reqs. "No secrets in git" is a good requirement i guess.

> user: secrets in git are not out of scope. It should be a requirement that no secrets land in git.

> user: Native GitHub Settings webhooks cannot wake Cursor/Grok Bot. GitHub sends HMAC. Cursor wants Authorization: Bearer <sender key>. HMAC in the hook Secret field is ignored.

> user: Standing fire path: a GitHub Action in each product repo POSTs GITHUB_EVENT_PATH to ONE builder webhook routine with Authorization: Bearer. One webhook for all Actions. Do not mint a second routine.

> user: Workflow secrets (never in git): GROK_BOT_WEBHOOK_URL, GROK_BOT_SENDER_KEY. Owner copies both from the Grok Bot routine panel. GitHub never returns secret values; setup cannot copy secrets from one repo to another.

> user: Cursor webhook wakes deliver {headers, body_digest, timestamp_ms}, not the POST body. Custom X-Factory-* headers are stripped. User-Agent survives. Identity must ride in User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref> and the wake materializes a gate-valid push JSON from that (or a real body if present). Fail closed if identity cannot be recovered. Never assume a single repo.

> user: Easy-install (fn-2) installs that Action on confirmed repos, plus the one builder webhook routine. It does NOT create Settings→Webhooks. Discover-then-confirm still stands. No auto-init of .flow/. No secrets in git (R7).

> user: Factory runtime (fn-1, already shipping): ADVANCED is quiet (next wake continues). DEFERRED_TO_LAND starts a land tick automatically (automatic factory; merge is not owner-gated). Ping only NEEDS_HUMAN or ASKED.

> user: Keep fn-2 generic (no personal names). Owner / GitHub / builder / notify stay instance config.

> user: Do not arm live repos as a side effect of rewriting the spec.

> user: Gate exits: 0 quiet / 10 start / 20 stuck.

> user: Merge is factory land. The owner still confirms ready on specs.

> user: Identity recovery for the wake: a real GitHub push body if present, else User-Agent factory-forward line, else fail-closed. Never assume a repo. X-Factory-* is not a required recovery path — Cursor strips them; the Action may still send them but the factory must not need them.

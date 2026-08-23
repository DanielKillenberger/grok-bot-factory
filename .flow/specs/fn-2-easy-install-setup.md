# fn-2-easy-install-setup Easy-install setup

## Overview

The owner sends this repo to their **main** Grok Bot agent. Main assigns (or creates) a builder, lists candidate repos, waits for confirm, then creates the builder’s webhook routine and GitHub **push** hooks on the confirmed set. After hooks exist, ticks are **fn-1**. This spec is work that factory can pick up once fn-1 runs from a hand-wired wake.

Discovery and hook creation are **programs** in this repo (plus a conversation skill that drives them). Agent/routine create has no public Grok Bot REST, so that part is conversational — not a reason to skip code for `gh` discovery and GitHub hook REST.

## Goal & Context
<!-- scope: business -->

Easy-install: send this repo to your **main** Grok Bot agent; it sets up the factory on the repos you confirm. [user]

Depends on **fn-1**. The factory must already run (hand-wired wake is enough). This spec is work that factory can pick up. [user]

Main supervises setup only. After hooks exist, ticks are fn-1. [user]

No secrets land in git. That is a requirement, not out of scope. [user]

## Approach

Setup is a **conversation** with main, plus GitHub REST for hooks. There is **no public Grok Bot REST** to create an agent or a webhook routine (docs-scout, 2026). Agent/routine creation is conversational/UI; fail closed if routine URL and sender key cannot be obtained from the panel (or owner paste). Do not invent a Grok Bot API client.

Reuse fn-1’s single-repo `.flow/` probe. Discovery **lists** candidates (`gh repo list` paginated + Contents/`.flow/` or `gh repo read-dir`); the fire path in fn-1 still checks one repo only.

1. Assign an existing builder. Create one only if none exists (conversational). Re-runs reuse the same builder and routine — do not mint a second routine (duplicate wakes).
2. List candidates; wait for confirm. Default: instance GitHub account repos with `.flow/`, via `gh`, no clone. Paginate `gh repo list` (do not stop at the 30-repo default). Fail closed with a visible error on auth, 429, 5xx, network, malformed output, or a mid-scan probe failure — never present a silent partial list as complete. Whitelist fallback (instance config; no filename in this repo).
3. Named repo with no `.flow/`: ask intent and whether to init flow-next. No auto-init, no silent skip. If they want init, they (or main, with consent) run `/flow-next:setup` on that repo. Setup must **not** overwrite an existing pin (R6; flow-next setup already skips already-set `review.backend` and an existing routing block).
4. Confirm handoff (R3): the mutate program accepts **only** an explicit owner-confirmed `owner/name` list. The skill invokes it only after the confirmation reply. Unconfirmed candidates never reach hook create.
5. On confirm: create the builder webhook routine `{ "type": "webhook" }` if missing. That routine **reuses fn-1’s contract**: command-first exec of the gate program on the delivered GitHub push body (zero model tokens), then the coordinator/tick runner, with the instance host-CLI input. Fail closed if routine URL and sender key cannot be obtained (owner paste from the panel is allowed). Do not invent a Grok Bot REST client.
6. GitHub hooks: paginate `GET /repos/{owner}/{repo}/hooks`. GitHub redacts `secret` as `********`, so GET cannot prove the sender key — never “skip equivalent” on URL match alone.
   - Zero hooks with this routine URL → `POST` `name: web`, `events: ["push"]`, `config.content_type: json`, `insecure_ssl: "0"`, url=routine URL, secret=sender key, `active: true`.
   - Exactly one hook with this routine URL → `PATCH` the complete desired config **including the current secret**, `active: true`, events exactly `["push"]`.
   - Two or more hooks with this routine URL → fail/report that repo (ambiguous); do not guess.
   - Duplicate-create `422` → re-GET and converge.
   Treat GitHub `ping` as reachability, not work.
7. Partial failure: no automatic rollback. Report what succeeded. Re-run is idempotent (converge hooks / reuse routine).
8. Deliverable is setup software. Do not arm live repos as a side effect of implementing this spec.

Rejected as overkill: a new GitHub/git bot; auto-init of `.flow/`; dashboard; inventing instance-config filenames; inventing Grok Bot REST.

## Architecture & Data Models
<!-- scope: technical -->

1. Owner sends this repo to the main agent. [user]
2. Assign an existing builder; create one only if none exists. [user]
3. List candidates; owner confirms. Default discovery: `.flow/` on the instance GitHub account, via `gh`, no clone. Whitelist fallback. [user]
4. Named repo with no `.flow`: ask whether they meant it and whether to init flow-next. No auto-init, no silent skip. [user]
5. Create the builder’s webhook routine `{ "type": "webhook" }` and a GitHub **push** hook on each confirmed repo (Payload URL = routine URL, Secret = sender key). A confirm card may appear. [user]
6. Do not overwrite a repo’s flow-next:setup pin. [user]

POST URL UI (if someone needs to look): agent name in chat header (or Cmd+Shift+I) → Routines list. [user]

## API Contracts
<!-- scope: technical -->

Setup inputs: builder (assign / create-if-none), repos (discover-then-confirm or whitelist), named-repo-without-`.flow` ask, CLI location. Autonomy knob values are still parked — do not invent them this spec. [user]

Setup outputs: routine on the builder, push hooks on confirmed repos. [user]

GitHub hook create: `POST /repos/{owner}/{repo}/hooks` with `name: "web"`, `events: ["push"]`, `config: { url, content_type: "json", secret, insecure_ssl: "0" }`. Admin permission required.

Storage filenames for instance inputs: unknown, instance config, not this git repo. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- Deliverable is setup software. Running it against live repos is a later owner yes. [user]
- Creating a Grok Bot builder agent when none exists is allowed. A new GitHub/git bot is not. [paraphrase]
- No public Grok Bot API for agents/routines: conversation/UI only; fail closed if URL+sender key cannot be obtained.
- Duplicate hooks multiply every push. Paginate GET; converge a unique URL match with PATCH+secret; report ambiguous duplicates.
- Incomplete discovery (default 30-repo cap, mid-scan failure) is an error, not a confirmable list.
- Partial setup: report; no automatic rollback; retry is idempotent.

## Quick commands

```bash
# Discovery smoke (no hooks): list .flow/ candidates via gh for a fixture owner,
# including a named repo without .flow/ that must prompt (not skip, not auto-init).
# Do not POST hooks to live repos as part of implementing this spec.
tests/factory/discover.test.sh
```

## Boundaries
<!-- scope: business -->

- Factory runtime is fn-1. [user]
- Do not arm live repos as a side effect of implementing this spec. [user]
- Out of scope: dashboard, inventing payload field names, inventing instance-config filenames. [user]
- Out of scope: automatic rollback of a partial hook install; inventing a Grok Bot REST client; autonomy-knob values.

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
- Agent/routine create is conversational because no public Grok Bot CRUD API exists (2026 docs). GitHub hooks use REST, which does exist.
- Content type is `json` (`application/json`).
- Partial-setup rollback is not built: idempotent retry + a success/fail report is enough.
- “Skip equivalent hooks” was rejected: GitHub never returns the real secret on GET (`********`), so URL match is not identity of the sender key. Converge with PATCH including the current secret.
- The easy-install routine is not a second factory. It must invoke fn-1’s gate command-first.

## Acceptance Criteria
<!-- scope: both -->

- **R1:** The owner can finish setup from a conversation with their main Grok Bot agent. Main supervises setup only. [user] Errors: UI-clicks-only as the only path fails this criterion.

- **R2:** Assign an existing builder by default. Create one only if none exists. [user] Errors: always creating a duplicate, or failing when none exists, fails this criterion.

- **R3:** Setup lists candidates and waits for confirm before adding hooks. Default: discover `.flow/` repos via `gh`, no clone. Whitelist fallback. [user] Errors: hooks before confirm, or a frozen allowlist in this public repo, fail this criterion.

- **R4:** On confirm, create the builder’s webhook routine and a GitHub push hook on each confirmed repo. [user] Errors: a different wake family as the install path fails this criterion.

- **R5:** If the owner named a repo with no `.flow`, ask whether they intended it and whether to init flow-next. [user] Errors: auto-init or silent skip of a named repo fails this criterion.

- **R6:** Do not overwrite a product repo’s flow-next:setup pin. [user] Errors: overwriting that pin fails this criterion.

- **R7:** Routine URL, sender key, tokens, PATs, sessions, and vault paths are not written to git. [user] Errors: reject any change that embeds them.

## Early proof point

Task fn-2-easy-install-setup.1 proves discover-then-confirm: complete candidate list (or a visible fail-closed error), confirm required, a named repo without `.flow/` asks (no auto-init, no silent skip), and the mutate program is not callable with an unconfirmed list. If that fails, do not create hooks.

## Requirement coverage

| Req | Description | Task(s) | Gap justification |
|-----|-------------|---------|-------------------|
| R1  | Finish setup from a conversation with main | fn-2-easy-install-setup.1, fn-2-easy-install-setup.2 | — |
| R2  | Assign existing builder; create only if none | fn-2-easy-install-setup.2 | — |
| R3  | Discover-then-confirm; gh no clone; whitelist fallback | fn-2-easy-install-setup.1, fn-2-easy-install-setup.2 | — |
| R4  | On confirm: builder webhook routine + GitHub push hooks | fn-2-easy-install-setup.2 | — |
| R5  | Named repo without `.flow/`: ask intent + init | fn-2-easy-install-setup.1 | — |
| R6  | Do not overwrite flow-next:setup pin | fn-2-easy-install-setup.2 | — |
| R7  | No secrets in git | fn-2-easy-install-setup.2 | — |

## Open questions

- Autonomy knob values (setup input in API Contracts) — parked; do not invent an enum this spec.
- Instance-config filenames — parked.
- How main obtains routine URL + sender key from the Grok Bot panel in conversation (owner paste is an acceptable fallback).

## References

- GitHub create webhook: https://docs.github.com/en/rest/repos/webhooks#create-a-repository-webhook
- GitHub Contents API: https://docs.github.com/en/rest/repos/contents
- `gh repo list`: https://cli.github.com/manual/gh_repo_list
- Grok Bot create agent (UI): https://docs.x.ai/grok-bot/bots
- Grok Bot routines (UI, no public CRUD): https://docs.x.ai/grok-bot/skills-routines-and-automations
- flow-next setup Keep-mine for existing pins: plugin `skills/flow-next-setup/workflow.md`

## Parked unknowns

- Autonomy knob values
- Instance-config filenames
- How the panel exposes routine URL + sender key to the agent (owner paste fallback)

## Conversation Evidence

> user: the first thing that needs built is a repo that you can send to whatever you call your main agent in grok bot and it'll just set it up for you.

> user: default is assign (Most who install this will have a builder) only if there is none will one be created

> user: discover-then-confirm

> user: setup agent should ask if the user intended that repo and if they want it to be setup with flow-next

> user: then we should do setup as fn-2

> user: looks good but check if we can't cut some reqs. Stuff like "we're not doing this" is often just superfluous.

> user: fn-2 looks like a fine amount of reqs. "No secrets in git" is a good requirement i guess.

> user: secrets in git are not out of scope. It should be a requirement that no secrets land in git.

---
satisfies: [R1, R2, R3, R4, R5, R6, R7, R11]
---
# fn-1-grok-bot-factory.1 Deterministic wake gate

## Description
Quiet-path gate for a GitHub push body (R2–R7, R11). Split from the tick runner so the consent boundary is provable without a host CLI.

**Size:** M
**Files:** `factory/gate.sh`, `factory/lib/github_push.sh`, `factory/lib/membership.sh`, `factory/lib/ready.sh`, `tests/factory/gate.test.sh`, `tests/fixtures/push-*.json`
**Touches:** [factory/, tests/factory/, tests/fixtures/]

## Approach
- Input: GitHub push JSON (file or stdin). Program only — no model.
- Closed identity schema: `repository.full_name` string `owner/name`; `after` 40-char lowercase hex (all-zero = deleted); `ref` string; `deleted` boolean if present. Wrong types, failed grammar, ping, deleted, missing keys → exit 0. Never fleet-scan. Pass values as quoted argv; never `eval`.
- Membership of **this** repo only: default = Contents `.flow/` at `after` (404 quiet, 403 exit 20). Optional whitelist via flag/env — no filename committed as product config.
- Ready: read `.flow/specs/*.json` and `.flow/tasks/*.json` at `after` via `gh api` / `gh repo read-dir`; queue only `ready: true`. Supervisor must not write ready.
- Kind: `land` if a ready spec is all-tasks-done with an open PR; else `pilot` if a ready spec/task is selectable; mixed → `land`; unclassifiable ready item → exit 20.
- Outcomes: 0 only when a quiet case is positively established; 10 start (`repo sha kind`); 20 stuck (stderr reason). Retry `gh` once on 429. Transport, 5xx, malformed API/sidecar JSON, partial directory reads, 403 → 20. Do not invent other exit codes.
- Tests with fixtures + stub `gh`. No live webhook. Prove zero account-list calls on the fire path.

## Investigation targets
**Required** (read before coding):
- `README.md:13-36` — hand-wire wake; gh no-clone ready check; quiet if none
- `.flow/specs/fn-1-grok-bot-factory.md` — R2–R7, R11, Approach, API Contracts
- `.flow/config.json` — instance review pin, not a host CLI

**Optional** (reference as needed):
- `.flow/specs/fn-2-easy-install-setup.md` — discovery vs fire-path split

## Key context
- Official push fields: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push — not Events API `head` / `repository_id`.
- Do not mix Grok Automations Standard Webhooks HMAC with this gate. Grok Bot authenticates; factory does not HMAC.
- `gh repo read-dir` (2026) reads remote dirs without clone.
- Pre-model invocation of this program is required (R3). This task proves the program; task 3 wires the routine to exec it with no model.

## Acceptance
- [ ] Fixture push with no ready work exits 0; no model; no status print
- [ ] Fixture missing identity / ping / deleted ref / wrong JSON types / invalid `owner/name` or SHA exits 0 and does not list account repos
- [ ] Fixture member repo with `ready: true` sidecar exits 10 and prints `owner/name sha kind`
- [ ] Kind fixtures: pilot-only → `pilot`; land-only (all-done + open PR) → `land`; mixed → `land`; unclassifiable ready → 20
- [ ] Ready check uses only the firing `full_name` + `after` (no fleet-scan)
- [ ] Unready / missing `ready` is ignored; gate never sets ready
- [ ] Default membership is `.flow/` at `after` for that repo; no hardcoded allowlist in the repo
- [ ] Non-default-branch `ref` is accepted (R11)
- [ ] Stubbed 403 / 5xx / network / malformed sidecar / partial read → exit 20; 404 → quiet
- [ ] External commands receive validated identity as argv (no `eval`)
- [ ] Tests do not arm a live GitHub hook or Grok Bot routine
- [ ] `tests/factory/gate.test.sh` passes

## Done summary
Deterministic GitHub-push wake gate: quiet 0 / start 10 (`repo sha kind`) / stuck 20. Membership is `.flow/` at `after` (optional `--whitelist` / `FACTORY_MEMBERSHIP_WHITELIST`); ready sidecars classify `pilot`/`land`. Fixture tests with stub `gh`; no live webhook.

baseline: red (tests/factory/gate.test.sh failed pre-edit: missing file — this task lands the suite)
stage: impl-review - ran [2026-08-23T22:03:16Z NEEDS_WORK .. 2026-08-23T22:10:00Z SHIP]
## Evidence
- Commits: 6a8ddfa4fe93696b55f063bba04e9963d5457fc1, 55baf3a79137fc7ddbf5cbce8c3edfbfa0c6496c, da15325400012c7bc390c1ffb8664f0ca8e57e9d
- Tests: tests/factory/gate.test.sh
- PRs:
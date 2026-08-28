# Factory stay worker

## Conversation Evidence

> user (turn 1): "This is a NEW spec. Do not rewrite fn-1, fn-2, or fn-3. Suggested id: fn-4-factory-stay-worker."

> user (turn 1): "Do NOT mark ready. Do NOT implement. Do NOT write Bun. The spec IS the state machine / outcome map. If a verdict has no next action, the spec is not ready to build. Map first, Bun later."

> user (turn 1): "Keep generic: owner / GitHub / builder / notify. No personal names. No secrets."

> user (turn 1, PICKUP): "Owner pushes a ready spec. Factory picks it up. That surface stays. Tick-per-push is the flake. Kill it. Webhook is pickup only, once. Later pushes resume-or-ignore, not a new tick. Single-flight: one spec / one branch at a time."

> user (turn 1, STAY): "One worker stays on that spec until merge or NEEDS_HUMAN. Same session through land. Stopping at make-pr / PR-up is the lottery again. If merge needs the owner's yes, that is ASKED in this session, not a new pickup. Persist after every phase (commit and push the spec branch if the tree moved). That is crash insurance on the same tree, not a new wake. git is the resume disk. Crash: no ping; next start classifies the next skill from git / flowctl, not from the dead process."

> user (turn 1, NOT PILOT): "Factory does not call /pilot. /pilot is one phase then exit. /loop calling /pilot once and dying is what we lived. Factory calls the real skills: plan, plan-review, work-rolling, make-pr, land. /pilot stays a human /loop tool."

> user (turn 1, DISPATCH): "Skip-planning mark set before the push: skip plan and plan-review, go to work-rolling. No skip mark and no tasks: walk all phases (plan, plan-review, work-rolling, make-pr, land). Tasks on disk and no skip mark: work what is there (work-rolling). Native flow-next only has `ready`. There is no native ready-to-work vs ready-to-plan key yet. The skip/plan-offload mark is a factory field until Gordon ships a native one. Do not teach it in easy-install as the product. If Gordon ships native statuses, read his."

> user (turn 1, WORK-ROLLING): "Always invoke /flow-next:work-rolling (not /flow-next:work). Host is `cursor-agent` in fast mode (implement default `cursor-grok-4.6-high-fast`). On this host work-rolling degrades to wave; take the wave. Do not add a Claude host just to roll. Do not spawn the grok CLI. cursor-agent for Sol review is a child of the stay script when a phase needs review, not a new builder-agent turn."

> user (turn 1, WORKER): "A Bun TypeScript program, same family as the existing factory program (gate + tick). Three programs, one child: webhook hits gate (start or silent); a new stay script is the loop; it spawns `cursor-agent` with one skill, waits until that process exits, commits, spawns the next. Not a Grok Bot subagent. Not the builder agent in the loop. Hang clock lives in the stay script. Silence past it is NEEDS_HUMAN in this session, not another pickup. No 20-minute poll. Dumb loop, smart skills. `cursor-agent` and Sol steer. NEEDS_WORK means run them again."

> user (turn 1, OUTCOME MAP): "NEEDS_WORK → same phase again (keep working; do not ask the owner). Phase done → persist, next skill. Merge → exit, quiet. ASKED → stay script exits; that exit is the one builder-agent wake; ask the owner. NEEDS_HUMAN → stay script exits; that exit is the one builder-agent wake; ping the owner. Hang clock → same as NEEDS_HUMAN. Crash → process gone; git has the phase; next pickup/resume continues. No ping. The only builder-agent wake is that stay-script exit. The wrap that waits on the Bun process lives in the shipped webhook path (a worker that holds until the stay script exits). Background Shell will not notify. This is factory, not a builder habit. Other installs must get the NEEDS_HUMAN ping."

> user (turn 1, OUT OF SCOPE): "Visibility board (what phase, still on it). Later. Second ready spec while one stay is running. Later. Same-account easy-install e2e. Later. Grok Bot platform wake-miss (ACK 200, no turn). Not this program. Teaching the factory-only plan key in easy-install."

> user (turn 1, STYLE): "Spec is the map. Concrete. Terse. Acceptance criteria from these locks only. ready=false. Draft."

> user (turn 4, Linus): "Resume has to re-derive the next skill from git / flowctl (tasks, PR, review status), not from memory the dead process had. Pickup table is first start. Crash table needs that classify, or a restart guesses."

> user (turn 4, Linus): "Same for the child: grok must exit with a verdict the stay script can parse. Process exits is not a next action. Hang clock number can wait for plan. Not ready until those two are on the map."

> user (turn 5): "btw i've been using cursor-agent seems much faster and efficient than grok build. switch the default to use cursor-agent everywhere as the host cli and use fast mode"

> user (turn 2): "How do we detect non converging work? If impl-review keeps finding issues we need some sort of escalation mechanism"

> user (turn 2, locked): "NEEDS_WORK is not forever. Same phase, three rounds without SHIP → NEEDS_HUMAN. Same majors after a fix are one round. A commit that does not answer the last review does not reset the count. Only a commit that answers the last review is progress. Hang clock is time. This cap is not-converging."

> user (turn 3): "Yes on install, if pickup changes. fn-3 still says gate then tick.ts. If the wrap + stay script is the new first action, this spec should update that README/skill beat. Not a second spec. Leave tick.ts as the old one-phase path or delete it. Do not leave both as the advertised start."

## Goal & Context
<!-- scope: business -->

<!-- Source-tag breakdown: 90% [user] / 10% [paraphrase] -->

The owner pushes a ready spec. Factory picks it up. That pickup surface stays. [user]

Tick-per-push is the flake. Kill it. `/loop` calling `/pilot` once and dying is what we lived. Stopping at make-pr / PR-up is the lottery again. [user]

One worker stays on that spec until merge or NEEDS_HUMAN. Same session through land. This spec is the state machine / outcome map. If a verdict has no next action, the spec is not ready to build. Map first, Bun later. [user]

Roles stay generic: owner / GitHub / builder / notify. No personal names. No secrets. [user]

This capture is draft. `ready=false`. Do not implement in this spec. [user]

New spec. Does not rewrite fn-1, fn-2, or fn-3. [user]

## Architecture & Data Models
<!-- scope: technical -->

<!-- Source-tag breakdown: 85% [user] / 15% [paraphrase] -->

Three programs, one child. [user]

1. **Gate.** Webhook hits gate. Start or silent. Pickup only, once. [user]
2. **Stay script.** The loop. A Bun TypeScript program, same family as the existing factory program (gate + tick). Spawns `cursor-agent` with one skill, waits until that process exits, persists, spawns the next. Hang clock lives here. [user]
3. **Child.** `cursor-agent` in fast mode, one skill per spawn. Implement default: `--model cursor-grok-4.6-high-fast`. Review stays `cursor-agent` with Sol (`gpt-5.6-sol-high`). Skills: plan, plan-review, work-rolling, make-pr, land. Never `/pilot`. [user]

**Wrap.** The shipped webhook path holds until the stay script exits. That exit is the one builder-agent wake. Background Shell will not notify. This is factory, not a builder habit. Other installs must get the NEEDS_HUMAN ping. [user]

The stay script is not a Grok Bot subagent. The builder agent is not in the loop. [user]

`cursor-agent` is the host CLI for every skill child, including Sol review. Review is still a stay-script child, not a new builder-agent turn. [user]

Host is `cursor-agent`, fast mode. Implement default `--model cursor-grok-4.6-high-fast`. Review stays Sol (`gpt-5.6-sol-high`) so implement and review stay two families. On this host, work-rolling degrades to wave. Take the wave. Do not add a Claude host just to roll. Do not spawn the grok CLI. [user]

Dumb loop, smart skills. `cursor-agent` and Sol steer. [user]

**Resume disk.** git. Persist after every phase: commit and push the spec branch if the tree moved. Crash insurance on the same tree, not a new wake. Crash: process gone, no ping. Next start resumes the next phase from git. [user]

**Single-flight.** One spec / one branch at a time. [user]

```mermaid
stateDiagram-v2
  [*] --> Pickup: owner pushes ready spec
  Pickup --> Silent: gate not start
  Pickup --> Stay: gate start (once)
  Stay --> Skill: spawn grok (one skill)
  Skill --> Stay: process exits
  Stay --> Skill: NEEDS_WORK (same phase, round < 3)
  Stay --> WakePing: NEEDS_WORK 3rd round no SHIP
  Stay --> Skill: phase done (persist, next skill)
  Stay --> Quiet: merge (exit, no ping)
  Stay --> WakeAsk: ASKED (stay exits)
  Stay --> WakePing: NEEDS_HUMAN (stay exits)
  Stay --> WakePing: hang clock
  Stay --> Dead: crash (process gone)
  Dead --> Stay: classify next skill from git / flowctl
  WakeAsk --> [*]: builder-agent asks owner
  WakePing --> [*]: builder-agent pings owner
  Quiet --> [*]
```

## API Contracts
<!-- scope: technical -->

The tables are the contract. Shown fields are the whole shape.

### Pickup

Webhook is pickup only, once. Later pushes resume-or-ignore, not a new tick. [user]

| Event | Action |
| --- | --- |
| Owner pushes a ready spec. No stay on that spec/branch. | Gate start. Stay script begins. |
| Later push while stay is running. | Ignore. Not a new tick. |
| Later push after crash (process gone). | Resume. Classify next skill from git / flowctl (see Crash resume). Not from the dead process. Not a new tick. |
| Gate does not start. | Silent. No stay. No ping. |

### Dispatch

Native flow-next only has `ready`. There is no native ready-to-work vs ready-to-plan key yet. The skip/plan-offload mark is a factory field until native flow-next ships equivalent statuses. Then read native. Do not teach the factory field in easy-install as the product. [user] [paraphrase]

| Skip-planning mark (set before the push) | Tasks on disk | First skill |
| --- | --- | --- |
| set | any | work-rolling (skip plan and plan-review) |
| unset | none | plan, then plan-review, then work-rolling, then make-pr, then land |
| unset | present | work-rolling (work what is there) |

Always invoke `/flow-next:work-rolling`. Never `/flow-next:work`. [user]


### Crash resume classify

Resume re-derives the next skill from git / flowctl. Not from memory the dead process had. Pickup table is first start. This table is restart. A restart that guesses fails this spec. [user]

| git / flowctl | Next skill |
| --- | --- |
| Spec merged or status done | Silent. No stay. |
| Open make-pr PR for this spec, not merged | land |
| Work complete (tasks done / completion ship), no qualifying make-pr PR | make-pr |
| Skip-planning mark set, work not complete | work-rolling |
| Tasks on disk, plan-review not ship, no skip mark | plan-review |
| Tasks on disk, plan-review ship or skip mark, work not complete | work-rolling |
| No skip mark, no tasks, no plan yet | plan |
| No skip mark, plan exists, plan-review not ship, no tasks | plan-review |
| No skip mark, no tasks, plan-review ship | work-rolling |

Signals are on disk: tasks, skip mark, plan-review status, open make-pr PR, merge / spec status. [user]

### Child verdict

`cursor-agent` must exit with a verdict the stay script can parse. "Process exits" is not a next action. [user]

| Child exit | Next action |
| --- | --- |
| Parseable verdict | Follow the outcome map. |
| Exit, no parseable verdict | NEEDS_HUMAN. Do not guess the next skill. Do not treat as phase done. |
| Hang clock (no exit) | Same as NEEDS_HUMAN. |

Hang-clock duration stays parked for plan. [user]

### Outcome map

Every verdict has a next action. A verdict with no next action means this spec is not ready to build. [user]

| Verdict | Next action | Persist | Builder-agent wake | Owner |
| --- | --- | --- | --- | --- |
| NEEDS_WORK (round < 3) | Same phase again. Keep working. | per phase | no | do not ask |
| NEEDS_WORK (3rd round, no SHIP) | Escalate. Same as NEEDS_HUMAN. | per phase | yes | ping |
| Same majors after a fix | One NEEDS_WORK round. Not a fresh problem. | - | no | do not ask |
| Commit that does not answer the last review | Does not reset the round count. | - | no | do not ask |
| Commit that answers the last review | Progress. Round count resets. | per phase | no | none |
| Phase done | Next skill. | commit and push spec branch if the tree moved | no | none |
| Merge | Stay script exits. | - | no | quiet |
| ASKED | Stay script exits. That exit is the one builder-agent wake. | - | yes | ask |
| NEEDS_HUMAN | Stay script exits. That exit is the one builder-agent wake. | - | yes | ping |
| Hang clock | Same as NEEDS_HUMAN. | - | yes | ping |
| Crash | Process gone. Next start classifies next skill from git / flowctl (Crash resume). | git already has the phase | no | no ping |
| Child exit, no parseable verdict | NEEDS_HUMAN. Do not guess. | - | yes | ping |

The only builder-agent wake is that stay-script exit. [user]

If merge needs the owner's yes, that is ASKED in this session, not a new pickup. [user]

## Edge Cases & Constraints
<!-- scope: technical -->

- Later push is never a new tick. Resume or ignore only. [user]
- Stopping at make-pr / PR-up fails stay. Land is in the same session. [user]
- Owner-yes merge is ASKED in this session. [user]
- Hang clock lives in the stay script. Silence past it is NEEDS_HUMAN in this session, not another pickup. No 20-minute poll. [user]
- Crash does not ping. Next start classifies the next skill from git / flowctl. A restart that guesses the next skill fails this spec. [user]
- Child exit without a parseable verdict is NEEDS_HUMAN. "Process exits" is not a next action. [user]
- Factory invoking `/pilot` fails this spec. `/pilot` stays a human `/loop` tool. [user]
- Adding a Claude host solely so work-rolling can roll fails this spec. Take the wave. [user]
- Spawning the grok CLI as the skill host fails this spec. Host is `cursor-agent` in fast mode. [user]
- Sol review as a new builder-agent turn fails this spec. It is a stay-script child. [user]
- Background Shell as the wait fails this spec. It will not notify. The wrap lives in the shipped webhook path. [user]
- Second ready spec while one stay is running is out of scope. Single-flight still holds: this spec must not start a second stay. [user]
- Grok Bot platform wake-miss (ACK 200, no turn) is not this program. [user]
- Unbounded NEEDS_WORK. Three rounds, no SHIP, then NEEDS_HUMAN. A commit that ignores the last review does not reset the count. [user]
- Install advertising `tick.ts` as the start after this ships. Stay-script plus wrap is the advertised start. [user]

## Acceptance Criteria
<!-- scope: both -->

- **R1:** Pickup is once. Owner pushes a ready spec. Factory picks it up (that surface stays). Webhook is pickup only, once. Later pushes resume-or-ignore, not a new tick. Single-flight: one spec / one branch at a time. Errors: later push while stay is running → ignore, not a new tick; later push after crash → resume next phase from git, not a new tick; gate not start → silent, no ping; starting a second stay while one is running → fail. [user]

- **R2:** One worker stays on that spec until merge or NEEDS_HUMAN. Same session through land. If merge needs the owner's yes, that is ASKED in this session, not a new pickup. Persist after every phase: commit and push the spec branch if the tree moved. git is the resume disk. Crash: no ping; next start classifies the next skill from git / flowctl, not from the dead process. Errors: stay-script exit at make-pr / PR-up without land → fail; owner-yes merge treated as a new pickup → fail; tree moved and not committed and pushed → fail; crash that pings → fail; crash that starts a new tick from scratch → fail; resume that guesses the next skill instead of classifying from git / flowctl → fail. [user]

- **R3:** Factory does not call `/pilot`. Factory calls the real skills: plan, plan-review, work-rolling, make-pr, land. `/pilot` stays a human `/loop` tool. Errors: factory invoking `/pilot` → fail. [user]

- **R4:** Dispatch matches the API Contracts dispatch table. Skip-planning mark set before the push → skip plan and plan-review, go to work-rolling. No skip mark and no tasks → walk all phases. Tasks on disk and no skip mark → work-rolling. Native flow-next only has `ready`. The skip/plan-offload mark is a factory field until native flow-next ships equivalent statuses. Then read native. Do not teach the factory field in easy-install as the product. Errors: skip mark ignored → fail; walking plan when skip mark was set before the push → fail; teaching the factory-only plan key in easy-install as the product → fail this criterion (out of this spec's product surface). [user] [paraphrase]

- **R5:** Always invoke `/flow-next:work-rolling`, never `/flow-next:work`. Host is `cursor-agent` in fast mode (implement default `cursor-grok-4.6-high-fast`). On this host work-rolling degrades to wave; take the wave. Do not add a Claude host just to roll. Do not spawn the grok CLI. `cursor-agent` for Sol review is a child of the stay script when a phase needs review, not a new builder-agent turn. Errors: invoking `/flow-next:work` → fail; adding a Claude host solely to roll → fail; spawning the grok CLI as host → fail; Sol review as a new builder-agent turn → fail. [user]

- **R6:** The stay script is a Bun TypeScript program in the same family as the existing factory program (gate + tick). Three programs, one child: webhook hits gate (start or silent); the stay script is the loop; it spawns `cursor-agent` with one skill, waits until that process exits, commits, spawns the next. Not a Grok Bot subagent. Not the builder agent in the loop. Hang clock lives in the stay script. Silence past it is NEEDS_HUMAN in this session, not another pickup. No 20-minute poll. Dumb loop, smart skills. `cursor-agent` and Sol steer. NEEDS_WORK means run them again. Errors: builder agent in the loop → fail; Grok Bot subagent as the stay loop → fail; 20-minute poll instead of hang clock → fail; NEEDS_WORK that asks the owner or leaves the phase → fail. [user]

- **R7:** The stay script implements the outcome map in API Contracts. Every verdict has the next action listed there. The only builder-agent wake is the stay-script exit (ASKED or NEEDS_HUMAN, including hang clock). The wrap that waits on the Bun process lives in the shipped webhook path (a worker that holds until the stay script exits). Background Shell will not notify. Other installs must get the NEEDS_HUMAN ping. Merge → exit, quiet. Crash → no ping; next pickup/resume continues from git. Errors: a verdict with no next action → fail (spec not ready to build); missing wrap so NEEDS_HUMAN never pings → fail; Background Shell as the wait → fail; builder-agent wake on phase-done, NEEDS_WORK, merge, or crash → fail. [user]

- **R8:** Non-converging work. NEEDS_WORK is not forever. Same phase, three rounds without SHIP → NEEDS_HUMAN. Same majors after a fix are one round. A commit that does not answer the last review does not reset the count. Only a commit that answers the last review is progress. Hang clock is time; this cap is not-converging. Errors: unbounded NEEDS_WORK loop → fail; counting a non-answering commit as progress / reset → fail; treating repeated same majors as a fresh problem that resets the cap → fail. [user]

- **R9:** Advertised pickup is stay-script plus wrap. Same spec updates the easy-install skill and README beat. `tick.ts` is the old one-phase path: delete it or leave it dead and unadvertised. Do not leave both as the advertised start. Do not teach the factory-only plan key in easy-install as the product. Errors: install still advertising gate then `tick.ts` as the start → fail; both stay-script and `tick.ts` advertised as the start → fail. [user]

- **R10:** Resume classifies the next skill from git / flowctl (tasks, skip mark, plan-review status, open make-pr PR, merge / spec status). Not from memory the dead process had. Pickup table is first start. Crash table is restart. The child must exit with a verdict the stay script can parse. Exit without a parseable verdict is NEEDS_HUMAN. "Process exits" is not a next action. Errors: resume that guesses → fail; treating a bare process exit as phase done → fail; continuing after an unparseable exit → fail. [user]

- **R11:** Host CLI is `cursor-agent` everywhere, fast mode. Implement default `--model cursor-grok-4.6-high-fast`. Review stays `cursor-agent --model gpt-5.6-sol-high` as a stay-script child. Do not spawn the grok CLI. Two-family split stays (implement fast grok-via-cursor, review Sol). Errors: grok CLI as host → fail; implement and review the same model → fail; missing fast on the implement child → fail. [user]

## Boundaries
<!-- scope: business -->

- Visibility board (what phase, still on it). Later. [user]
- Second ready spec while one stay is running (queue/switch). Later. Single-flight in R1 still holds. [user]
- Same-account easy-install e2e. Later. [user]
- Grok Bot platform wake-miss (ACK 200, no turn). Not this program. [user]
- Teaching the factory-only plan key in easy-install as the product (the skip mark). Updating the advertised pickup to stay-script plus wrap is this spec (R9). [user]
- Implementing the Bun stay program in this spec. Map first, Bun later. This spec does not write the program. [user]
- Rewrite of fn-1, fn-2, or fn-3. [user]
- Personal names. Secrets. [user]

## Decision Context
<!-- scope: both — conditionally substructured -->

### Motivation
<!-- scope: business -->

Tick-per-push is the flake. `/loop` calling `/pilot` once and dying is what we lived. Stopping at make-pr / PR-up is the lottery again. [user]

Stay through land so merge or NEEDS_HUMAN / ASKED happens in this session. Owner-yes merge is ASKED here, not a new pickup. [user]

The wrap lives in the shipped webhook path because Background Shell will not notify. Other installs must get the NEEDS_HUMAN ping. That is factory, not a builder habit. [user]

Map first. If a verdict has no next action, the spec is not ready to build. Bun later. [user]

## Parked unknowns

- Hang clock duration. Locked: silence past it is NEEDS_HUMAN in this session, no 20-minute poll. The number is unset. Resolve at plan. [user]

## Requirement coverage

| R-ID | Task | Notes |
| --- | --- | --- |
| R1 | fn-4.M (TBD - populate via /flow-next:plan) | Pickup once, resume-or-ignore, single-flight |
| R2 | fn-4.M (TBD - populate via /flow-next:plan) | Stay through land, persist, git resume |
| R3 | fn-4.M (TBD - populate via /flow-next:plan) | Real skills, never /pilot |
| R4 | fn-4.M (TBD - populate via /flow-next:plan) | Dispatch table, factory skip mark |
| R5 | fn-4.M (TBD - populate via /flow-next:plan) | work-rolling, grok wave, Sol child |
| R6 | fn-4.M (TBD - populate via /flow-next:plan) | Stay script shape, hang clock, dumb loop |
| R7 | fn-4.M (TBD - populate via /flow-next:plan) | Outcome map + webhook wrap |
| R8 | fn-4.M (TBD - populate via /flow-next:plan) | Three-round NEEDS_WORK cap |
| R9 | fn-4.M (TBD - populate via /flow-next:plan) | Install advertises stay+wrap, not tick.ts |
| R10 | fn-4.M (TBD - populate via /flow-next:plan) | Resume classify + parseable child verdict |
| R11 | fn-4.M (TBD - populate via /flow-next:plan) | cursor-agent host, fast implement, Sol review |

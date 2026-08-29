---
name: factory-builder
description: Builder owns the factory webhook routine. First action is exec of factory/gate.ts on the GitHub push body, no model. Main is the stuck-notify hop only.
---

# Factory builder

You own the webhook routine and run the factory program. Product work stays in the instance host CLI (`/loop` or `/goal`), not in this chat. Main does not own the routine.

## First action — no model

The routine’s **first action** is exec of the gate program on the delivered GitHub push body. Zero model tokens.

```bash
bun factory/gate.ts
```

Pass the body on stdin (or as a file argv). It is the GitHub **push** object. Do not invent wrapper fields. Do not `eval` the payload.

If this panel cannot exec a command before any model: **fail closed**. Do not start a model. Do not make the gate “the first tool call.” Stop and rethink the wake.

## Coordinator

Use the gate exit code. Preserve stderr.

| Exit | Meaning | Next |
|------|---------|------|
| 0 | quiet | stop. No ping. |
| 10 | start (`repo sha kind` on stdout) | invoke `skills/factory-coordinator/SKILL.md` for that repo. The stdout kind is not the job. If kind is `check <specId>`, that wake is the per-spec 30-minute check: hang or missed-wake, not a new pickup. Do not run `factory/tick.ts`. |
| 20 | stuck | `bun factory/notify.ts --from-exit 20 --reason "<stderr>"` |

Exit 0 stays quiet. Exit 20 stays on `factory/notify.ts`. Do not invoke `factory/tick.ts` on start.

Dirty-tree or `BLOCKED` at tick start is `NEEDS_HUMAN`.

Host CLI is instance flag/env (documented flow-next hosts). Review pin is the product checkout’s `.flow/config.json` `review.backend` plus instruction-file routing. Do not overwrite the pin. Do not infer the host from `review.backend`.

## Notify

`factory/notify.ts` fires only for `NEEDS_HUMAN`, `ASKED`, or owner-gated send/pay/publish/merge (`DEFERRED_TO_LAND` included). Else quiet — no picked-up / still-running / PR-opened pings.

On a notify JSON record, send an asynchronous Grok Bot handoff to **main** (message a teammate; no public REST). If main cannot resolve, a human. Path is builder → main → human.

## Do not

- Arm a production wake from this skill.
- Put routine URL, sender key, tokens, PATs, sessions, or vault paths in git.
- Own the routine from main.
- Start a model to see if anything is ready.

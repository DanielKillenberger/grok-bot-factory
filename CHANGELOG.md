# Changelog

## Unreleased

### Added

- Factory runtime: deterministic GitHub-push wake gate, isolated tick runner, and stuck/owner-gated notify (builder → main → human). The builder owns the webhook routine and execs the gate before any model. Implementing this does not arm a production wake.
- Easy-install: short-beat walkthrough (orient → find repos → you pick → builder/webhook → paste two secrets → done). Conversation-first; fire path unchanged (confirm set, one builder webhook, factory-forward Action + two secrets, not Settings hooks).

### Changed

- `hostProbe` treats an inventory `grok` binary as a loop host even when `grok --help` omits `/loop` and `/goal` (Grok Build slash commands). Other inventory hosts still scan `--help`.
- `hostRun` invokes basename `grok` via `script -q -e -f -c … <tick-home>/host.typescript` so grok has a PTY, with `--always-approve --no-alt-screen` and one prompt (`/loop 10m <skill>` or `/goal <skill>`). Missing `script(1)` is stuck. Other inventory hosts keep Claude-shaped split argv.
- `hostRun` ends a grok host on the first `PILOT_VERDICT=` or `LAND_VERDICT=` line in the typescript or script stdout: SIGTERM the script/grok process group, return that line as stdout, exit 0. If grok exits first, return captured typescript/stdout. Timeout still SIGKILL.
- `hostRun` also polls `~/.grok/sessions/<encodeURIComponent(realpath(tree))>/**/{chat_history,updates}.jsonl` (that tree only) for the same verdict line, because grok TUI does not paint `PILOT_VERDICT` onto the PTY. First match SIGTERMs the process group and returns the line, same as a typescript hit.
- `hostRun` (and tick) only treat `PILOT_VERDICT=` / `LAND_VERDICT=` as a hit when the value is `ADVANCED|ASKED|NO_WORK|DEFERRED_TO_LAND|BLOCKED|NEEDS_HUMAN` and the next field is `spec=` (pilot) or `prs=` (land). The `/loop` prompt template `PILOT_VERDICT=<ADVANCED|…>` and recipe prose like `PILOT_VERDICT=NO_WORK or PILOT_VERDICT=NEEDS_HUMAN` are ignored.
- `hostRun` session jsonl watch only accepts a verdict from records with `type==="assistant"` (JSON-parse each line; skip parse failures and `tool_result` / `user` / `reasoning`). Real verdicts are a terminal line in `assistant.content`. Typescript / PTY stay raw-text. The `spec=` / `prs=` regex is unchanged.
- Tick stuck reasons for a nonzero host exit include the host's first trimmed stderr line, or the first non-verdict PTY/stdout line when script wraps grok.
- Factory program is TypeScript on Bun (not bash). Gate, tick, and notify stay exec-able (`bun` / shebang) with the same fail-closed exits (0 quiet, 10 start, 20 stuck). Proof command is `bun test`.
- Gate recovers wake identity from a real GitHub push body if present, else `User-Agent: factory-forward repo=<owner/name> sha=<40hex> ref=<git-ref>`, else fail closed.

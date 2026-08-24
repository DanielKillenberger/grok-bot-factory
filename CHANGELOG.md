# Changelog

## Unreleased

### Added

- Factory runtime: deterministic GitHub-push wake gate, isolated tick runner, and stuck/owner-gated notify (builder → main → human). The builder owns the webhook routine and execs the gate before any model. Implementing this does not arm a production wake.

### Changed

- `hostProbe` treats an inventory `grok` binary as a loop host even when `grok --help` omits `/loop` and `/goal` (Grok Build slash commands). Other inventory hosts still scan `--help`.
- `hostRun` invokes basename `grok` via `script -q -e -f -c … <tick-home>/host.typescript` so grok has a PTY, with `--always-approve --no-alt-screen` and one prompt (`/loop 10m <skill>` or `/goal <skill>`). Missing `script(1)` is stuck. Other inventory hosts keep Claude-shaped split argv.
- `hostRun` ends a grok host on the first `PILOT_VERDICT=` or `LAND_VERDICT=` line in the typescript or script stdout: SIGTERM the script/grok process group, return that line as stdout, exit 0. If grok exits first, return captured typescript/stdout. Timeout still SIGKILL.
- Tick stuck reasons for a nonzero host exit include the host's first trimmed stderr line, or the first non-verdict PTY/stdout line when script wraps grok.
- Factory program is TypeScript on Bun (not bash). Gate, tick, and notify stay exec-able (`bun` / shebang) with the same fail-closed exits (0 quiet, 10 start, 20 stuck). Proof command is `bun test`.

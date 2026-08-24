# Changelog

## Unreleased

### Added

- Factory runtime: deterministic GitHub-push wake gate, isolated tick runner, and stuck/owner-gated notify (builder → main → human). The builder owns the webhook routine and execs the gate before any model. Implementing this does not arm a production wake.

### Changed

- `hostProbe` treats an inventory `grok` binary as a loop host even when `grok --help` omits `/loop` and `/goal` (Grok Build slash commands). Other inventory hosts still scan `--help`.
- `hostRun` invokes basename `grok` via `script -q -e -c … /dev/null` so grok has a PTY, with `--always-approve --no-alt-screen` and one prompt (`/loop 10m <skill>` or `/goal <skill>`). Missing `script(1)` is stuck. Other inventory hosts keep Claude-shaped split argv.
- Tick stuck reasons for a nonzero host exit include the host's first trimmed stderr line, or the first non-verdict PTY/stdout line when script wraps grok.
- Factory program is TypeScript on Bun (not bash). Gate, tick, and notify stay exec-able (`bun` / shebang) with the same fail-closed exits (0 quiet, 10 start, 20 stuck). Proof command is `bun test`.

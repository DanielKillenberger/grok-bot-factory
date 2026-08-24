# Changelog

## Unreleased

### Added

- Factory runtime: deterministic GitHub-push wake gate, isolated tick runner, and stuck/owner-gated notify (builder → main → human). The builder owns the webhook routine and execs the gate before any model. Implementing this does not arm a production wake.

### Changed

- Factory program is TypeScript on Bun (not bash). Gate, tick, and notify stay exec-able (`bun` / shebang) with the same fail-closed exits (0 quiet, 10 start, 20 stuck). Proof command is `bun test`.

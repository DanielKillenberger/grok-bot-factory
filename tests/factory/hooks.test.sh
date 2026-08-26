#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
exec bun test tests/factory/hooks.test.ts tests/factory/secrets.test.ts

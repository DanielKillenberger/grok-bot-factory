#!/usr/bin/env bash
# Fail if tracked files embed routine URL, sender key, tokens, PATs, sessions, or vault paths.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$ROOT"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

n=0
failures=0

pass() {
  n=$((n + 1))
  printf 'ok %s %s\n' "$n" "$*"
}

fail() {
  n=$((n + 1))
  failures=$((failures + 1))
  printf 'not ok %s %s\n' "$n" "$*"
}

# Return 0 if clean, 1 if a secret-like embedding is found.
scan_path() {
  local f="$1" hits
  [ -f "$f" ] || return 0
  [ -s "$f" ] || return 0
  hits=$(grep -nE \
    -e 'ghp_[A-Za-z0-9]{20,}' \
    -e 'gho_[A-Za-z0-9]{20,}' \
    -e 'github_pat_[A-Za-z0-9_]{20,}' \
    -e 'glpat-[A-Za-z0-9_-]{20,}' \
    -e 'whsec_[A-Za-z0-9+/=_-]{16,}' \
    -e '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----' \
    -e '(ROUTINE_URL|WEBHOOK_URL)[[:space:]]*=[[:space:]]*https?://' \
    -e '(SENDER_KEY|sender_key|WEBHOOK_SECRET)[[:space:]]*=[[:space:]]*[^[:space:]"$<{][^[:space:]]+' \
    -e '(SESSION_TOKEN|SESSION_ID|session_token|session_id)[[:space:]]*=[[:space:]]*[^[:space:]"$<{][^[:space:]]+' \
    -e '(^|[=:[:space:]])(~/\.vault/|/[A-Za-z0-9._/-]+/\.vault/|/var/lib/vault/|op://[A-Za-z0-9._-]+/)' \
    -e 'VAULT_(ADDR|TOKEN)[[:space:]]*=[[:space:]]*[^[:space:]"$<{][^[:space:]]+' \
    -e 'hooks\.github\.com/' \
    "$f" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi
  return 0
}

# Planted embeddings must be detected (file is not git-tracked).
plant() {
  local label="$1" body="$2" out
  printf '%s\n' "$body" >"$TMP/planted"
  if out=$(scan_path "$TMP/planted"); then
    fail "$label (scanner missed planted secret)"
  else
    pass "$label"
  fi
}

plant "detects GitHub PAT" "token=ghp_abcdefghijklmnopqrstuvwxyz0123456789"
plant "detects routine URL assignment" "ROUTINE_URL=https://example.invalid/webhook/abc"
plant "detects sender key assignment" "SENDER_KEY=s3cr3tvalue0123456789abcd"
plant "detects session token assignment" "session_token=abc123def456ghi789jkl012"
plant "detects vault path" "file=/home/user/.vault/secrets/github"
plant "detects VAULT_ADDR" "VAULT_ADDR=https://vault.example.invalid"

# Category names in docs are not embeddings.
printf '%s\n' "Routine URL, sender key, tokens, PATs, sessions, and vault paths." >"$TMP/docs"
if scan_path "$TMP/docs"; then
  pass "docs category names are not secrets"
else
  fail "docs category names false-positive"
fi

# Tracked files must be clean (R15).
tracked_dirty=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if out=$(scan_path "$f"); then
    continue
  fi
  fail "tracked $f embeds a secret/url/key/vault path"
  tracked_dirty=1
done < <(git ls-files)

if [ "$tracked_dirty" -eq 0 ]; then
  pass "no secrets, routine URL, sender key, or vault paths in git"
fi

if [ "$failures" -ne 0 ]; then
  printf '%s failures in %s tests\n' "$failures" "$n" >&2
  exit 1
fi
printf '%s tests passed\n' "$n"
exit 0

#!/usr/bin/env bash
# Fail if tracked files embed routine URL, sender key, tokens, PATs, sessions, or vault paths.
# Planted values are assembled at runtime so complete embeddings are not in git.
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

_docs_host() {
  case "$1" in
    *://docs.github.com/*|*://docs.x.ai/*|*://flow-next.dev/*|*://cli.github.com/*|*://git-scm.com/*)
      return 0
      ;;
  esac
  return 1
}

# Return 0 if clean, 1 if a secret-like embedding is found.
scan_path() {
  local f="$1" hits url
  [ -f "$f" ] || return 0
  [ -s "$f" ] || return 0

  hits=$(grep -nE \
    -e 'ghp_[A-Za-z0-9]{20,}' \
    -e 'gho_[A-Za-z0-9]{20,}' \
    -e 'github_pat_[A-Za-z0-9_]{20,}' \
    -e 'glpat-[A-Za-z0-9_-]{20,}' \
    -e 'whsec_[A-Za-z0-9+/=_-]{16,}' \
    -e '-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----' \
    "$f" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi

  hits=$(grep -nEi \
    -e '(ROUTINE_URL|WEBHOOK_URL|SENDER_KEY|sender_key|WEBHOOK_SECRET|API_TOKEN|GITHUB_TOKEN|GH_TOKEN|AUTH_TOKEN|ACCESS_TOKEN|BOT_TOKEN|SESSION_TOKEN|SESSION_ID|session_token|session_id|VAULT_ADDR|VAULT_TOKEN)[[:space:]]*[=:][[:space:]]*[^[:space:]"$<{][^[:space:]]{11,}' \
    -e '"(sender_key|routine_url|webhook_url|webhook_secret|api_token|github_token|session_token|session_id|vault_token|vault_addr)"[[:space:]]*:[[:space:]]*"[^"<${][^"]{11,}"' \
    "$f" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi

  hits=$(grep -nE \
    -e '(^|[=:[:space:]])(~/\.vault/|/[A-Za-z0-9._/-]+/\.vault/|/var/lib/vault/|op://[A-Za-z0-9._-]+/)' \
    -e 'hooks\.github\.com/' \
    -e 'api\.github.com/repos/[^[:space:]]+/hooks' \
    "$f" 2>/dev/null || true)
  if [ -n "$hits" ]; then
    printf '%s\n' "$hits"
    return 1
  fi

  while IFS= read -r url; do
    [ -n "$url" ] || continue
    if _docs_host "$url"; then
      continue
    fi
    printf '%s\n' "$url"
    return 1
  done < <(grep -oE 'https?://[^[:space:]"'"'"']+(webhook|routine)[^[:space:]"'"'"']*' "$f" 2>/dev/null || true)

  return 0
}

plant() {
  local label="$1" body="$2"
  printf '%s\n' "$body" >"$TMP/planted"
  if scan_path "$TMP/planted" >/dev/null; then
    fail "$label (scanner missed planted secret)"
  else
    pass "$label"
  fi
}

# Fragments only — concatenated values must not appear as literals in this file.
pfx=ghp_
rest=abcdefghijklmnopqrstuvwxyz0123
scheme=https://
host=example.invalid
wpath=/webhook/abc
key=SENDER_KEY
jkey=sender_key
val=s3cr3tvalue0123456789abcd
sk=session_token
tk=API_TOKEN
vk=VAULT_ADDR
vp_home=/home/user
vp_rest=.vault/secrets/github

plant "detects GitHub PAT" "token=${pfx}${rest}"
plant "detects routine URL assignment" "ROUTINE_URL=${scheme}${host}${wpath}"
plant "detects bare routine URL" "${scheme}${host}${wpath}"
plant "detects sender key assignment" "${key}=${val}"
plant "detects JSON sender key" "\"${jkey}\": \"${val}\""
plant "detects YAML sender key" "${jkey}: ${val}"
plant "detects API_TOKEN assignment" "${tk}=${val}"
plant "detects session token assignment" "${sk}=${val}"
plant "detects vault path" "file=${vp_home}/${vp_rest}"
plant "detects VAULT_ADDR" "${vk}=${scheme}vault.${host}"

# Category names and documentation URLs are not embeddings.
printf '%s\n' "Routine URL, sender key, tokens, PATs, sessions, and vault paths." >"$TMP/docs"
if scan_path "$TMP/docs" >/dev/null; then
  pass "docs category names are not secrets"
else
  fail "docs category names false-positive"
fi

printf '%s\n' "Payload URL = the routine URL" "Secret = the sender key from the panel" >"$TMP/handwire"
if scan_path "$TMP/handwire" >/dev/null; then
  pass "hand-wire prose is not a secret"
else
  fail "hand-wire prose false-positive"
fi

printf '%s\n' "https://docs.github.com/en/webhooks/webhook-events-and-payloads#push" >"$TMP/docurl"
if scan_path "$TMP/docurl" >/dev/null; then
  pass "docs.github.com webhook URL is not a secret"
else
  fail "docs.github.com webhook URL false-positive"
fi

printf '%s\n' "https://docs.x.ai/grok-bot/skills-routines-and-automations" >"$TMP/xaiurl"
if scan_path "$TMP/xaiurl" >/dev/null; then
  pass "docs.x.ai routine URL is not a secret"
else
  fail "docs.x.ai routine URL false-positive"
fi

# Tracked files must be clean (R15).
tracked_dirty=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if scan_path "$f" >/dev/null; then
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

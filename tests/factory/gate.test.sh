#!/usr/bin/env bash
# Fixture gate tests. Do not POST to a live GitHub hook or Grok Bot routine.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
GATE="$ROOT/factory/gate.sh"
FIX="$ROOT/tests/fixtures"
STUB="$ROOT/tests/factory/stub-gh"
SHA="0123456789abcdef0123456789abcdef01234567"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BIN="$TMP/bin"
mkdir -p "$BIN"
ln -s "$STUB" "$BIN/gh"
chmod +x "$STUB" "$GATE"

export PATH="$BIN:$PATH"
export FACTORY_FIXTURES="$FIX"
unset FACTORY_MEMBERSHIP_WHITELIST || true

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

run_gate() {
  local out err
  out=$(mktemp)
  err=$(mktemp)
  set +e
  bash "$GATE" "$@" >"$out" 2>"$err"
  RC=$?
  set -e
  STDOUT=$(cat "$out")
  STDERR=$(cat "$err")
  rm -f "$out" "$err"
}

fresh_log() {
  FACTORY_GH_LOG="$TMP/gh.log"
  export FACTORY_GH_LOG
  : >"$FACTORY_GH_LOG"
  rm -f "$FACTORY_GH_LOG.fleet" "$FACTORY_GH_LOG.429"
}

assert_no_fleet() {
  if [ -f "$FACTORY_GH_LOG.fleet" ]; then
    fail "$1 (fleet-scan: $(cat "$FACTORY_GH_LOG.fleet"))"
    return
  fi
  if grep -Eq 'repo list|repo ls|user/repos|search/repositories|/orgs/' "$FACTORY_GH_LOG"; then
    fail "$1 (account-list in gh log)"
    return
  fi
  pass "$1"
}

assert_quiet() {
  local label="$1"
  if [ "$RC" -ne 0 ]; then
    fail "$label (exit $RC stdout=$(printf %q "$STDOUT") stderr=$(printf %q "$STDERR"))"
    return
  fi
  if [ -n "$STDOUT" ]; then
    fail "$label (status print: $(printf %q "$STDOUT"))"
    return
  fi
  assert_no_fleet "$label"
}

assert_start() {
  local label="$1" kind="$2"
  local want="acme/app ${SHA} ${kind}"
  if [ "$RC" -ne 10 ]; then
    fail "$label (exit $RC want 10 stderr=$(printf %q "$STDERR"))"
    return
  fi
  if [ "$STDOUT" != "$want" ]; then
    fail "$label (stdout $(printf %q "$STDOUT") want $(printf %q "$want"))"
    return
  fi
  assert_no_fleet "$label"
}

assert_stuck() {
  local label="$1"
  if [ "$RC" -ne 20 ]; then
    fail "$label (exit $RC want 20 stdout=$(printf %q "$STDOUT") stderr=$(printf %q "$STDERR"))"
    return
  fi
  if [ -z "$STDERR" ]; then
    fail "$label (missing stderr reason)"
    return
  fi
  assert_no_fleet "$label"
}

# --- identity quiet table (no model, no fleet-scan, no status print) ---
fresh_log
export FACTORY_STUB=empty
while IFS=$'\t' read -r label file; do
  fresh_log
  run_gate "$file"
  assert_quiet "$label"
  if [ -s "$FACTORY_GH_LOG" ]; then
    fail "$label (gh invoked on identity quiet path)"
  else
    pass "$label (no gh on identity path)"
  fi
done <<EOF
ping	$FIX/push-ping.json
deleted	$FIX/push-deleted.json
deleted-zero-sha	$FIX/push-deleted-zero-sha.json
missing-identity	$FIX/push-missing.json
wrong-types	$FIX/push-wrong-types.json
invalid-owner-name	$FIX/push-invalid-name.json
invalid-sha	$FIX/push-invalid-sha.json
events-api-fields	$FIX/push-events-api.json
not-json	$FIX/push-not-json.txt
EOF

# --- member repo, nothing ready → quiet (R5) ---
fresh_log
export FACTORY_STUB=empty
run_gate "$FIX/push-ok.json"
assert_quiet "no ready work"

# --- 404 membership → quiet ---
fresh_log
export FACTORY_STUB=membership_404
run_gate "$FIX/push-ok.json"
assert_quiet "contents 404 quiet"

# --- ready start + kind table ---
fresh_log
export FACTORY_STUB=pilot
run_gate "$FIX/push-ok.json"
assert_start "ready spec/task starts" pilot

fresh_log
export FACTORY_STUB=land
run_gate "$FIX/push-ok.json"
assert_start "land-only" land

fresh_log
export FACTORY_STUB=mixed
run_gate "$FIX/push-ok.json"
assert_start "mixed land+pilot" land

fresh_log
export FACTORY_STUB=unclassifiable
run_gate "$FIX/push-ok.json"
assert_stuck "unclassifiable ready"

# --- non-default-branch ref (R11) ---
fresh_log
export FACTORY_STUB=feature
run_gate "$FIX/push-feature-branch.json"
assert_start "non-default-branch ref" pilot

# --- unready / missing ready ignored (R6) ---
fresh_log
export FACTORY_STUB=unready
run_gate "$FIX/push-ok.json"
assert_quiet "unready and missing ready ignored"

# --- firing repo only (R4) ---
fresh_log
export FACTORY_STUB=pilot
run_gate "$FIX/push-ok.json"
if grep -q "repos/acme/app/" "$FACTORY_GH_LOG" && grep -q "ref=$SHA" "$FACTORY_GH_LOG"; then
  if grep -E 'repos/[^ ]+/' "$FACTORY_GH_LOG" | grep -vq 'repos/acme/app/'; then
    fail "ready check other repo in log"
  else
    pass "ready check only firing full_name+after"
  fi
else
  fail "ready check missing firing repo/sha in log"
fi

# --- never writes ready ---
if grep -Eq -- '--method (PUT|PATCH|POST|DELETE)|spec ready' "$FACTORY_GH_LOG"; then
  fail "gate wrote ready or mutated GitHub"
else
  pass "gate never sets ready"
fi

# --- transport / stuck table ---
fresh_log
export FACTORY_STUB=membership_403
run_gate "$FIX/push-ok.json"
assert_stuck "contents 403"

fresh_log
export FACTORY_STUB=membership_500
run_gate "$FIX/push-ok.json"
assert_stuck "contents 5xx"

fresh_log
export FACTORY_STUB=network
run_gate "$FIX/push-ok.json"
assert_stuck "network"

fresh_log
export FACTORY_STUB=malformed
run_gate "$FIX/push-ok.json"
assert_stuck "malformed sidecar"

fresh_log
export FACTORY_STUB=partial
run_gate "$FIX/push-ok.json"
assert_stuck "partial directory read"

fresh_log
export FACTORY_STUB=missing_specs
run_gate "$FIX/push-ok.json"
assert_quiet "missing sidecar dirs are quiet"

fresh_log
export FACTORY_STUB=bad_listing
run_gate "$FIX/push-ok.json"
assert_stuck "malformed directory listing"

fresh_log
export FACTORY_STUB=bad_task
run_gate "$FIX/push-ok.json"
assert_stuck "malformed ready task"

fresh_log
export FACTORY_STUB=feature
run_gate "$FIX/push-ref-punct.json"
assert_start "punctuation-bearing git ref" pilot

# --- 429 retry once then proceed ---
fresh_log
export FACTORY_STUB=429_then_ok
run_gate "$FIX/push-ok.json"
assert_quiet "429 retry then quiet"

# --- stdin ---
fresh_log
export FACTORY_STUB=empty
run_gate <"$FIX/push-ok.json"
assert_quiet "stdin no ready work"

# --- whitelist overlay (R7): non-member without listing the account ---
fresh_log
export FACTORY_STUB=pilot
export FACTORY_MEMBERSHIP_WHITELIST="other/repo"
run_gate "$FIX/push-ok.json"
assert_quiet "whitelist miss is quiet"
if [ -s "$FACTORY_GH_LOG" ]; then
  fail "whitelist miss should not probe GitHub"
else
  pass "whitelist miss does not probe GitHub"
fi
unset FACTORY_MEMBERSHIP_WHITELIST

fresh_log
export FACTORY_STUB=pilot
run_gate --whitelist acme/app "$FIX/push-ok.json"
assert_start "whitelist hit starts" pilot
unset FACTORY_MEMBERSHIP_WHITELIST || true

# --- argv / no eval / no hardcoded allowlist / no default-branch gate ---
if grep -RE '(^|[^[:alnum:]_])eval[[:space:]]' "$ROOT/factory"; then
  fail "eval used in factory"
else
  pass "no eval in factory"
fi
if grep -RE 'default_branch' "$ROOT/factory"; then
  fail "default-branch-only check present"
else
  pass "no default-branch product default"
fi
if grep -RE 'ALLOWED_|allowlist\s*=' "$ROOT/factory"; then
  fail "hardcoded allowlist in factory"
else
  pass "no hardcoded allowlist"
fi
if grep -RE 'api\\.github.com/repos/.*/hooks|hooks\\.github' "$ROOT/factory" "$ROOT/tests/fixtures"; then
  fail "live hook URL embedded in factory or fixtures"
else
  pass "tests do not arm a live hook"
fi

if [ "$failures" -ne 0 ]; then
  printf '%s failures in %s tests\n' "$failures" "$n" >&2
  exit 1
fi
printf '%s tests passed\n' "$n"
exit 0

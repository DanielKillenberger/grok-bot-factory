#!/usr/bin/env bash
# Fixture tests for factory/gate.sh. No live GitHub, no live Grok Bot routine.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GATE="$ROOT/factory/gate.sh"
FIX="$ROOT/tests/fixtures"
STUB="$ROOT/tests/factory/gh-stub.sh"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }

run_gate() {
  local payload="$1"
  local stdoutf="$WORKDIR/stdout" stderrf="$WORKDIR/stderr"
  : >"$GH_STUB_LOG"
  set +e
  PATH="$(dirname "$STUB"):$PATH" "$GATE" "$payload" >"$stdoutf" 2>"$stderrf"
  rc=$?
  set -e
}

assert_quiet() {
  local name="$1" payload="$2"
  GH_STUB_CASE="${GH_STUB_CASE:-no_flow}"
  GH_STUB_LOG="$WORKDIR/gh.log"
  export GH_STUB_CASE GH_STUB_LOG
  run_gate "$payload"
  [ "$rc" -eq 0 ] || fail "$name: expected exit 0 got $rc stderr=$(cat "$WORKDIR/stderr")"
  [ ! -s "$WORKDIR/stdout" ] || fail "$name: quiet must print nothing, got $(cat "$WORKDIR/stdout")"
}

assert_no_gh() {
  local name="$1"
  [ ! -s "$GH_STUB_LOG" ] || fail "$name: expected no gh calls, log=$(cat "$GH_STUB_LOG")"
}

assert_no_fleet() {
  local name="$1"
  if [ -f "$GH_STUB_LOG" ] && grep -q FLEET_SCAN "$GH_STUB_LOG" 2>/dev/null; then
    fail "$name: fleet-scan"
  fi
  if [ -f "$GH_STUB_LOG" ] && grep -E 'repo list|user/repos|user/orgs' "$GH_STUB_LOG"; then
    fail "$name: account-list gh call"
  fi
}

chmod +x "$GATE" "$STUB"
mkdir -p "$WORKDIR/bin"
cp "$STUB" "$WORKDIR/bin/gh"
chmod +x "$WORKDIR/bin/gh"
export PATH="$WORKDIR/bin:$PATH"

# --- identity / quiet, no fleet-scan, no gh ---
GH_STUB_LOG="$WORKDIR/gh.log"
export GH_STUB_LOG
: >"$GH_STUB_LOG"

GH_STUB_CASE=no_flow
assert_quiet "ping" "$FIX/push-ping.json"
assert_no_gh "ping"

assert_quiet "deleted" "$FIX/push-deleted.json"
assert_no_gh "deleted"

assert_quiet "deleted-zero" "$FIX/push-deleted-zero.json"
assert_no_gh "deleted-zero"

assert_quiet "missing-identity" "$FIX/push-missing.json"
assert_no_gh "missing-identity"

assert_quiet "wrong-types" "$FIX/push-wrong-types.json"
assert_no_gh "wrong-types"

assert_quiet "invalid-name" "$FIX/push-invalid-name.json"
assert_no_gh "invalid-name"

assert_quiet "invalid-sha" "$FIX/push-invalid-sha.json"
assert_no_gh "invalid-sha"

assert_quiet "uppercase-sha" "$FIX/push-uppercase-sha.json"
assert_no_gh "uppercase-sha"

assert_quiet "deleted-string" "$FIX/push-deleted-string.json"
assert_no_gh "deleted-string"

# --- 404 membership → quiet ---
GH_STUB_CASE=no_flow
assert_quiet "no-flow-404" "$FIX/push-ok.json"
assert_no_fleet "no-flow-404"
grep -q 'contents/.flow' "$GH_STUB_LOG" || fail "no-flow-404: expected .flow contents check"

# --- empty member / unready / missing ready → quiet ---
GH_STUB_CASE=empty_flow
assert_quiet "empty-flow" "$FIX/push-ok.json"
assert_no_fleet "empty-flow"

GH_STUB_CASE=unready
assert_quiet "unready" "$FIX/push-ok.json"

GH_STUB_CASE=missing_ready
assert_quiet "missing-ready" "$FIX/push-ok.json"

# --- whitelist overlay: non-member quiet, zero gh ---
: >"$GH_STUB_LOG"
set +e
FACTORY_MEMBERS="other/repo" PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "whitelist-miss exit $rc"
[ ! -s "$WORKDIR/stdout" ] || fail "whitelist-miss printed"
assert_no_gh "whitelist-miss"

# --- start: ready pilot ---
GH_STUB_CASE=ready_pilot
: >"$GH_STUB_LOG"
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 10 ] || fail "ready-pilot: expected 10 got $rc stderr=$(cat "$WORKDIR/stderr")"
[ "$(cat "$WORKDIR/stdout")" = "acme/widget aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa pilot" ] \
  || fail "ready-pilot stdout: $(cat "$WORKDIR/stdout")"
assert_no_fleet "ready-pilot"
if grep -E 'repo list|user/repos' "$GH_STUB_LOG"; then fail "ready-pilot fleet"; fi
# only firing repo
grep -q 'repos/acme/widget/contents' "$GH_STUB_LOG" || fail "ready-pilot: missing firing-repo contents"

# --- feature branch (R11) ---
GH_STUB_CASE=feature_branch
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-feature-branch.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 10 ] || fail "feature-branch: expected 10 got $rc stderr=$(cat "$WORKDIR/stderr")"
grep -q ' pilot$' "$WORKDIR/stdout" || fail "feature-branch kind"

# --- land ---
GH_STUB_CASE=ready_land
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 10 ] || fail "land: expected 10 got $rc stderr=$(cat "$WORKDIR/stderr")"
[ "$(cat "$WORKDIR/stdout")" = "acme/widget aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa land" ] \
  || fail "land stdout: $(cat "$WORKDIR/stdout")"

# --- mixed → land ---
GH_STUB_CASE=mixed
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 10 ] || fail "mixed: expected 10 got $rc stderr=$(cat "$WORKDIR/stderr")"
grep -q ' land$' "$WORKDIR/stdout" || fail "mixed kind $(cat "$WORKDIR/stdout")"

# --- ready task only → pilot ---
GH_STUB_CASE=ready_task_only
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 10 ] || fail "task-only: expected 10 got $rc stderr=$(cat "$WORKDIR/stderr")"
grep -q ' pilot$' "$WORKDIR/stdout" || fail "task-only kind"

# --- unclassifiable → 20 ---
GH_STUB_CASE=unclassifiable
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "unclassifiable: expected 20 got $rc"
[ -s "$WORKDIR/stderr" ] || fail "unclassifiable: expected stderr reason"

# --- malformed sidecar → 20 ---
GH_STUB_CASE=malformed_sidecar
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "malformed: expected 20 got $rc"

# --- partial read → 20 ---
GH_STUB_CASE=partial_read
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "partial: expected 20 got $rc"

# --- 403 / 5xx / network → 20 ---
GH_STUB_CASE=forbidden
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "403: expected 20 got $rc"

GH_STUB_CASE=server_error
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "5xx: expected 20 got $rc"

GH_STUB_CASE=network
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 20 ] || fail "network: expected 20 got $rc"

# --- 429 retried once then quiet empty ---
GH_STUB_COUNT_FILE="$WORKDIR/429.count"
printf '0\n' >"$GH_STUB_COUNT_FILE"
export GH_STUB_COUNT_FILE
GH_STUB_CASE=retry_429
set +e
PATH="$WORKDIR/bin:$PATH" "$GATE" "$FIX/push-ok.json" >"$WORKDIR/stdout" 2>"$WORKDIR/stderr"
rc=$?
set -e
[ "$rc" -eq 0 ] || fail "429-retry: expected 0 got $rc stderr=$(cat "$WORKDIR/stderr")"
[ "$(cat "$GH_STUB_COUNT_FILE")" -ge 2 ] || fail "429-retry: did not retry"

# --- no eval in factory ---
if grep -REn '(^|[^[:alnum:]_])eval[[:space:]]' "$ROOT/factory"; then
  fail "factory uses eval"
fi

# --- no hardcoded allowlist of product repos ---
if grep -REn 'DanielKillenberger|frozen-allowlist' "$ROOT/factory"; then
  fail "hardcoded allowlist"
fi

printf 'OK tests/factory/gate.test.sh\n'

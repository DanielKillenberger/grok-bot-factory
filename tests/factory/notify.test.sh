#!/usr/bin/env bash
# Notify helper + coordinator stub. No live routine or webhook.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
GATE="$ROOT/factory/gate.sh"
TICK="$ROOT/factory/tick.sh"
NOTIFY="$ROOT/factory/notify.sh"
FIX="$ROOT/tests/fixtures"
STUB="$ROOT/tests/factory/stub-gh"
STUB_HOST="$ROOT/tests/factory/stub-host"
SKILL="$ROOT/skills/factory-builder/SKILL.md"
SHA="0123456789abcdef0123456789abcdef01234567"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BIN="$TMP/bin"
WT="$TMP/wt"
mkdir -p "$BIN" "$WT"
ln -s "$STUB" "$BIN/gh"
ln -s "$STUB_HOST" "$BIN/grok"
chmod +x "$STUB" "$STUB_HOST" "$GATE" "$TICK" "$NOTIFY"

export PATH="$BIN:$PATH"
export FACTORY_FIXTURES="$FIX"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
unset FACTORY_MEMBERSHIP_WHITELIST || true
unset FACTORY_HOST || true
unset FACTORY_CLONE_URL || true
unset FACTORY_WORKTREE_ROOT || true


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

NOTIFY_STDOUT=""
NOTIFY_STDERR=""
NOTIFY_RC=0
GATE_RC=0
GATE_STDOUT=""
GATE_STDERR=""
TICK_RC=0
TICK_STDOUT=""
TICK_STDERR=""

fresh_notify_log() {
  FACTORY_NOTIFY_LOG="$TMP/notify.log"
  export FACTORY_NOTIFY_LOG
  : >"$FACTORY_NOTIFY_LOG"
}

run_notify() {
  local out err
  out=$(mktemp)
  err=$(mktemp)
  set +e
  bash "$NOTIFY" "$@" >"$out" 2>"$err"
  NOTIFY_RC=$?
  set -e
  NOTIFY_STDOUT=$(cat "$out")
  NOTIFY_STDERR=$(cat "$err")
  rm -f "$out" "$err"
}

run_gate() {
  local out err
  out=$(mktemp)
  err=$(mktemp)
  set +e
  bash "$GATE" "$@" >"$out" 2>"$err"
  GATE_RC=$?
  set -e
  GATE_STDOUT=$(cat "$out")
  GATE_STDERR=$(cat "$err")
  rm -f "$out" "$err"
}

run_tick() {
  local out err
  out=$(mktemp)
  err=$(mktemp)
  set +e
  bash "$TICK" "$@" >"$out" 2>"$err"
  TICK_RC=$?
  set -e
  TICK_STDOUT=$(cat "$out")
  TICK_STDERR=$(cat "$err")
  rm -f "$out" "$err"
}

fresh_gh() {
  FACTORY_GH_LOG="$TMP/gh.log"
  export FACTORY_GH_LOG
  : >"$FACTORY_GH_LOG"
  rm -f "$FACTORY_GH_LOG.fleet" "$FACTORY_GH_LOG.429"
}

fresh_host_log() {
  FACTORY_HOST_LOG="$TMP/host.log"
  FACTORY_HOST_PWD_LOG="$TMP/host.pwd"
  FACTORY_CLOUD_LOG="$TMP/cloud.log"
  export FACTORY_HOST_LOG FACTORY_HOST_PWD_LOG FACTORY_CLOUD_LOG
  : >"$FACTORY_HOST_LOG"
  : >"$FACTORY_HOST_PWD_LOG"
  : >"$FACTORY_CLOUD_LOG"
  unset FACTORY_HOST_HOLD || true
  unset FACTORY_HOST_SLEEP || true
  FACTORY_HOST_HELP=loop
  FACTORY_HOST_VERDICT=NO_WORK
  export FACTORY_HOST_HELP FACTORY_HOST_VERDICT
}

make_product() {
  local dir="$1" backend="${2:-none}"
  rm -rf -- "$dir"
  mkdir -p -- "$dir/.flow"
  git init -q "$dir"
  git -C "$dir" checkout -q -b main
  git -C "$dir" -c user.email=t@t -c user.name=t commit --allow-empty -qm init
  printf '%s\n' "{\"review\":{\"backend\":\"${backend}\"}}" >"$dir/.flow/config.json"
  git -C "$dir" -c user.email=t@t -c user.name=t add -A
  git -C "$dir" -c user.email=t@t -c user.name=t commit -qm pin
  PRODUCT_SHA=$(git -C "$dir" rev-parse HEAD)
}

assert_quiet() {
  local label="$1"
  if [ "$NOTIFY_RC" -ne 0 ]; then
    fail "$label (exit $NOTIFY_RC stderr=$(printf %q "$NOTIFY_STDERR"))"
    return
  fi
  if [ -n "$NOTIFY_STDOUT" ]; then
    fail "$label (stdout $(printf %q "$NOTIFY_STDOUT"))"
    return
  fi
  if [ -s "$FACTORY_NOTIFY_LOG" ]; then
    fail "$label (notify log not empty)"
    return
  fi
  if printf '%s\n' "$NOTIFY_STDOUT$NOTIFY_STDERR" | grep -Eq 'picked up|still running|PR opened|progress ping'; then
    fail "$label (progress ping)"
    return
  fi
  pass "$label"
}

assert_fired() {
  local label="$1" want="$2"
  local got
  if [ "$NOTIFY_RC" -ne 0 ]; then
    fail "$label (exit $NOTIFY_RC stderr=$(printf %q "$NOTIFY_STDERR"))"
    return
  fi
  got=$(printf '%s\n' "$NOTIFY_STDOUT" | jq -r '.event' 2>/dev/null || true)
  if [ "$got" != "$want" ]; then
    fail "$label (event $(printf %q "$got") want $want stdout=$(printf %q "$NOTIFY_STDOUT"))"
    return
  fi
  if [ "$(printf '%s\n' "$NOTIFY_STDOUT" | jq -r '.path')" != "builder->main->human" ]; then
    fail "$label (path not builder->main->human)"
    return
  fi
  if ! grep -q '"event":' "$FACTORY_NOTIFY_LOG"; then
    fail "$label (missing notify log)"
    return
  fi
  pass "$label"
}

# --- R10 event table (plus dirty-tree/BLOCKED → NEEDS_HUMAN; progress quiet) ---
while IFS=$'\t' read -r label event expect; do
  fresh_notify_log
  run_notify --event "$event"
  if [ "$expect" = quiet ]; then
    assert_quiet "$label"
  else
    assert_fired "$label" "$expect"
  fi
done <<'EOF'
needs-human	NEEDS_HUMAN	NEEDS_HUMAN
asked	ASKED	ASKED
deferred	DEFERRED_TO_LAND	DEFERRED_TO_LAND
send	send	send
pay	pay	pay
publish	publish	publish
merge	merge	merge
blocked	BLOCKED	NEEDS_HUMAN
dirty-tree	dirty-tree	NEEDS_HUMAN
picked-up	picked up	quiet
still-running	still running	quiet
pr-opened	PR opened	quiet
no-work	NO_WORK	quiet
EOF

fresh_notify_log
run_notify --from-exit 0
assert_quiet "from-exit 0 quiet"

fresh_notify_log
run_notify --from-exit 10 --reason "acme/app ${SHA} pilot"
assert_quiet "from-exit 10 start is quiet"

# --- coordinator stub: Contents-403 from gate → NEEDS_HUMAN with reason ---
fresh_gh
fresh_notify_log
export FACTORY_STUB=membership_403
run_gate "$FIX/push-ok.json"
if [ "$GATE_RC" -ne 20 ]; then
  fail "gate 403 (exit $GATE_RC want 20)"
else
  pass "gate 403 exits 20"
fi
run_notify --from-exit "$GATE_RC" --reason "$GATE_STDERR"
assert_fired "coordinator 403 → NEEDS_HUMAN" NEEDS_HUMAN
if printf '%s\n' "$NOTIFY_STDOUT" | grep -q 403; then
  pass "403 reason preserved"
else
  fail "403 reason not preserved ($(printf %q "$NOTIFY_STDOUT"))"
fi

# --- coordinator stub: missing host → NEEDS_HUMAN ---
fresh_host_log
fresh_notify_log
PRODUCT="$TMP/product"
make_product "$PRODUCT" none
empty_path="$TMP/empty-path"
mkdir -p "$empty_path"
PATH="$empty_path:/usr/bin:/bin" run_tick --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
if [ "$TICK_RC" -ne 20 ]; then
  fail "missing host (exit $TICK_RC want 20)"
else
  pass "missing host exits 20"
fi
run_notify --from-exit "$TICK_RC" --reason "$TICK_STDERR"
assert_fired "coordinator missing host → NEEDS_HUMAN" NEEDS_HUMAN
if printf '%s\n' "$NOTIFY_STDOUT" | grep -qi host; then
  pass "missing-host reason preserved"
else
  fail "missing-host reason not preserved ($(printf %q "$NOTIFY_STDOUT"))"
fi

# --- coordinator stub: unfulfillable review pin → NEEDS_HUMAN ---
fresh_host_log
fresh_notify_log
make_product "$PRODUCT" bogus
PATH="$BIN:/usr/bin:/bin" run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
if [ "$TICK_RC" -ne 20 ]; then
  fail "unfulfillable pin (exit $TICK_RC want 20)"
else
  pass "unfulfillable pin exits 20"
fi
run_notify --from-exit "$TICK_RC" --reason "$TICK_STDERR"
assert_fired "coordinator pin-failure → NEEDS_HUMAN" NEEDS_HUMAN
if printf '%s\n' "$NOTIFY_STDOUT" | grep -qi pin; then
  pass "pin-failure reason preserved"
else
  fail "pin-failure reason not preserved ($(printf %q "$NOTIFY_STDOUT"))"
fi

# --- host ASKED / DEFERRED_TO_LAND / BLOCKED via from-exit ---
fresh_notify_log
run_notify --from-exit 20 --reason "host verdict ASKED"
assert_fired "from-exit ASKED" ASKED

fresh_notify_log
run_notify --from-exit 20 --reason "host verdict DEFERRED_TO_LAND"
assert_fired "from-exit DEFERRED_TO_LAND" DEFERRED_TO_LAND

fresh_notify_log
run_notify --from-exit 20 --reason "host verdict BLOCKED"
assert_fired "from-exit BLOCKED → NEEDS_HUMAN" NEEDS_HUMAN

fresh_notify_log
run_notify --from-exit 20 --reason "dirty working tree at tick start"
assert_fired "dirty-tree reason → NEEDS_HUMAN" NEEDS_HUMAN

# --- builder skill contract ---
if grep -q 'factory/gate.sh' "$SKILL" && grep -qi 'no model' "$SKILL"; then
  pass "builder skill execs gate first with no model"
else
  fail "builder skill missing gate-first / no-model"
fi
if grep -Eqi 'fail closed|do not start a model' "$SKILL"; then
  pass "command-before-model fails closed"
else
  fail "skill missing fail-closed command-before-model"
fi
if grep -qi 'main is the stuck' "$SKILL" || grep -qi 'stuck-notify hop' "$SKILL" || grep -qi 'Main does not own the routine' "$SKILL"; then
  pass "main is stuck hop only"
else
  fail "skill does not keep main as stuck hop"
fi
if grep -qi 'you own the webhook routine' "$SKILL" || grep -qi 'builder owns' "$SKILL"; then
  pass "builder owns the routine"
else
  fail "skill does not assign routine to builder"
fi

# --- README contracts ---
if grep -q 'cursor:gpt-5.6-sol-high' "$ROOT/README.md" "$SKILL"; then
  fail "hardcoded instance review model as product default"
else
  pass "no hardcoded instance review model"
fi
if grep -Eqi 'runbook only' "$ROOT/README.md"; then
  fail "README still claims runbook-only"
else
  pass "README is not runbook-only"
fi
if grep -q 'factory/gate.sh' "$ROOT/README.md" && grep -qi 'hand' "$ROOT/README.md"; then
  pass "README still describes hand-wired push → routine"
else
  fail "README dropped hand-wire wake"
fi
if grep -qi 'easy-install is later' "$ROOT/README.md" || grep -qi 'not required' "$ROOT/README.md"; then
  pass "README does not require easy-install"
else
  fail "README requires easy-install"
fi
if grep -qi 'instance host CLI' "$ROOT/README.md" && grep -qi 'review pin' "$ROOT/README.md"; then
  pass "README distinguishes host CLI from review pin"
else
  fail "README does not distinguish host CLI from review pin"
fi
if grep -qi 'do not arm' "$ROOT/README.md" && grep -qiE "don't arm|does not arm|do not arm" "$ROOT/CHANGELOG.md"; then
  pass "don't-arm remains"
else
  fail "don't-arm missing from README or CHANGELOG"
fi

# --- no live routine / webhook as a side effect ---
if grep -RE 'api\.github.com/repos/.*/hooks|hooks\.github' "$ROOT/factory/notify.sh" "$ROOT/skills" "$ROOT/tests/factory/notify.test.sh"; then
  fail "live hook URL embedded"
else
  pass "tests do not arm a live hook"
fi
if grep -RE '(^|[^[:alnum:]_])eval[[:space:]]' "$ROOT/factory/notify.sh"; then
  fail "eval used in notify"
else
  pass "no eval in notify"
fi

if [ "$failures" -ne 0 ]; then
  printf '%s failures in %s tests\n' "$failures" "$n" >&2
  exit 1
fi
printf '%s tests passed\n' "$n"
exit 0

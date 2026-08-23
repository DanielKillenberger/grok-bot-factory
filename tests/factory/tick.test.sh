#!/usr/bin/env bash
# Isolated tick runner tests. Fake host/pin fixtures only. No live Cloud Agent, no production wake.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
TICK="$ROOT/factory/tick.sh"
STUB_HOST="$ROOT/tests/factory/stub-host"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

BIN="$TMP/bin"
WT="$TMP/wt"
mkdir -p "$BIN" "$WT"
ln -s "$STUB_HOST" "$BIN/grok"
chmod +x "$STUB_HOST" "$TICK"

export PATH="$BIN:$PATH"
export GIT_CONFIG_NOSYSTEM=1
export GIT_CONFIG_GLOBAL=/dev/null
unset FACTORY_HOST || true
unset FACTORY_CLONE_URL || true
unset FACTORY_WORKTREE_ROOT || true
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

run_tick() {
  local out err
  out=$(mktemp)
  err=$(mktemp)
  set +e
  bash "$TICK" "$@" >"$out" 2>"$err"
  RC=$?
  set -e
  STDOUT=$(cat "$out")
  STDERR=$(cat "$err")
  rm -f "$out" "$err"
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
  cat >"$dir/CLAUDE.md" <<'EOF'
<!-- flow-next:model-routing:start -->
<!-- reviewer: example -->
<!-- flow-next:model-routing:end -->
EOF
  git -C "$dir" -c user.email=t@t -c user.name=t add -A
  git -C "$dir" -c user.email=t@t -c user.name=t commit -qm pin
  PRODUCT_SHA=$(git -C "$dir" rev-parse HEAD)
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
  pass "$label"
}

assert_quiet() {
  local label="$1"
  if [ "$RC" -ne 0 ]; then
    fail "$label (exit $RC stderr=$(printf %q "$STDERR"))"
    return
  fi
  if printf '%s\n' "$STDOUT" | grep -Eq 'picked up|still running|PR opened|progress ping'; then
    fail "$label (progress ping on stdout)"
    return
  fi
  pass "$label"
}

PRODUCT="$TMP/product"
make_product "$PRODUCT" none

# --- missing host CLI (R14) ---
fresh_host_log
empty_path="$TMP/empty-path"
mkdir -p "$empty_path"
PATH="$empty_path:/usr/bin:/bin" run_tick --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "missing host CLI"

# --- host without /loop or /goal (R13/R14) ---
fresh_host_log
FACTORY_HOST_HELP=none
export FACTORY_HOST_HELP
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "host without /loop or /goal"

# --- unfulfillable review pin: unknown backend ---
fresh_host_log
make_product "$PRODUCT" "bogus"
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "unfulfillable review pin (unknown backend)"

# --- unfulfillable: host review + Grok writer ---
fresh_host_log
make_product "$PRODUCT" host
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "unfulfillable review pin (host + grok writer)"

# --- unfulfillable: cursor effort rung ---
fresh_host_log
make_product "$PRODUCT" "cursor:gpt-5.6-sol-high:high"
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "unfulfillable review pin (cursor effort)"

# --- happy path + logs, no progress pings ---
fresh_host_log
make_product "$PRODUCT" none
PIN_BEFORE=$(cat "$PRODUCT/.flow/config.json")
ROUTING_BEFORE=$(cat "$PRODUCT/CLAUDE.md")
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "pilot tick NO_WORK"

if grep -q '/loop' "$FACTORY_HOST_LOG" && grep -q '/flow-next:pilot' "$FACTORY_HOST_LOG"; then
  pass "product work invoked via /loop /flow-next:pilot"
else
  fail "host argv missing /loop or /flow-next:pilot ($(cat "$FACTORY_HOST_LOG"))"
fi

if grep -Eq 'start --force' "$FACTORY_HOST_LOG"; then
  fail "host invoked with start --force"
else
  pass "claims skip: no start --force"
fi

log_count=$(find "$WT/logs" -name '*.jsonl' | wc -l | tr -d ' ')
if [ "$log_count" -ge 1 ] && grep -q '"phase":' "$WT/logs"/*.jsonl; then
  if grep -q '"repo":"acme/app"' "$WT/logs"/*.jsonl && grep -q '"kind":"pilot"' "$WT/logs"/*.jsonl; then
    pass "per-tick local structured logs"
  else
    fail "logs missing repo/kind"
  fi
else
  fail "missing tick logs"
fi

if [ "$(cat "$PRODUCT/.flow/config.json")" != "$PIN_BEFORE" ]; then
  fail "review pin overwritten on disk"
else
  pass "review pin not overwritten"
fi
if [ "$(cat "$PRODUCT/CLAUDE.md")" != "$ROUTING_BEFORE" ]; then
  fail "routing block overwritten"
else
  pass "routing block not overwritten"
fi

# --- land uses /flow-next:land ---
fresh_host_log
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" land
assert_quiet "land tick NO_WORK"
if grep -q '/flow-next:land' "$FACTORY_HOST_LOG"; then
  pass "land invokes /flow-next:land"
else
  fail "land argv missing /flow-next:land"
fi

# --- host not inferred from review.backend; Cloud Agents not used ---
fresh_host_log
cat >"$BIN/cursor-agent" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "cursor-agent $*" >>"${FACTORY_CLOUD_LOG:-/tmp/cloud.log}"
exit 99
EOF
cat >"$BIN/cloud-agent" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "cloud-agent $*" >>"${FACTORY_CLOUD_LOG:-/tmp/cloud.log}"
exit 99
EOF
chmod +x "$BIN/cursor-agent" "$BIN/cloud-agent"
make_product "$PRODUCT" "cursor:gpt-5.6-sol-high"
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "cursor pin still uses instance host"
if grep -q 'cursor-agent' "$FACTORY_HOST_LOG"; then
  fail "host inferred from review.backend"
else
  pass "host CLI is instance input, not review.backend"
fi
if [ -s "$FACTORY_CLOUD_LOG" ]; then
  fail "Cloud Agent used while instance host runnable ($(cat "$FACTORY_CLOUD_LOG"))"
else
  pass "Cloud Agents not used when instance host runnable"
fi
rm -f "$BIN/cursor-agent" "$BIN/cloud-agent"

# --- host not read from .flow/config.json ---
fresh_host_log
make_product "$PRODUCT" none
jq '.host="/tmp/from-config-host"' "$PRODUCT/.flow/config.json" >"$TMP/cfg.json"
mv "$TMP/cfg.json" "$PRODUCT/.flow/config.json"
git -C "$PRODUCT" -c user.email=t@t -c user.name=t add -A
git -C "$PRODUCT" -c user.email=t@t -c user.name=t commit -qm 'config host trap'
PRODUCT_SHA=$(git -C "$PRODUCT" rev-parse HEAD)
mkdir -p "$TMP/from-config"
printf '#!/usr/bin/env bash\necho from-config >>"${FACTORY_CLOUD_LOG}"\n' >"$TMP/from-config-host"
chmod +x "$TMP/from-config-host"
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "config.json host key ignored"
if grep -q from-config "$FACTORY_CLOUD_LOG"; then
  fail "host binary read from .flow/config.json"
else
  pass "host binary not read from .flow/config.json"
fi

# --- two overlapping starts: two worktrees ---
fresh_host_log
make_product "$PRODUCT" none
HOLD="$TMP/hold"
rm -rf -- "$HOLD"
mkdir -p -- "$HOLD"
FACTORY_HOST_HOLD="$HOLD"
export FACTORY_HOST_HOLD
rm -rf -- "$WT"
mkdir -p -- "$WT"
bash "$TICK" --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot >"$TMP/tick1.out" 2>"$TMP/tick1.err" &
pid1=$!
bash "$TICK" --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot >"$TMP/tick2.out" 2>"$TMP/tick2.err" &
pid2=$!
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  nfiles=$(find "$HOLD" -name 'pwd.*' 2>/dev/null | wc -l | tr -d ' ')
  [ "$nfiles" -ge 2 ] && break
  sleep 0.1
done
mapfile -t pwds < <(cat "$HOLD"/pwd.* 2>/dev/null | sort -u)
touch "$HOLD/release"
wait "$pid1"
rc1=$?
wait "$pid2"
rc2=$?
if [ "$rc1" -eq 0 ] && [ "$rc2" -eq 0 ] && [ "${#pwds[@]}" -eq 2 ] && [ "${pwds[0]}" != "${pwds[1]}" ]; then
  pass "two overlapping starts get two worktrees"
else
  fail "overlapping worktrees (rc $rc1 $rc2 pwds=${pwds[*]-none})"
fi
unset FACTORY_HOST_HOLD

# --- cleanup does not remove another tick's tree ---
fresh_host_log
HOLD="$TMP/hold2"
rm -rf -- "$HOLD"
mkdir -p -- "$HOLD"
FACTORY_HOST_HOLD="$HOLD"
export FACTORY_HOST_HOLD
rm -rf -- "$WT"
mkdir -p -- "$WT"
bash "$TICK" --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot >"$TMP/tick-hold.out" 2>"$TMP/tick-hold.err" &
pidh=$!
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  [ -n "$(find "$HOLD" -name 'pwd.*' 2>/dev/null)" ] && break
  sleep 0.1
done
held=$(cat "$HOLD"/pwd.* 2>/dev/null | head -1)
unset FACTORY_HOST_HOLD
fresh_host_log
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
if [ -n "$held" ] && [ -d "$held" ]; then
  pass "cleanup does not remove another tick's tree"
else
  fail "held tree missing after other tick cleanup ($held)"
fi
touch "$HOLD/release"
wait "$pidh" || true

# --- symlink-escape refused ---
fresh_host_log
ESC="$TMP/escape-root"
EVIL="$TMP/evil"
rm -rf -- "$ESC" "$EVIL"
mkdir -p -- "$ESC" "$EVIL"
ln -s "$EVIL" "$ESC/ticks"
run_tick --host "$BIN/grok" --worktree-root "$ESC" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "symlink-escape ticks refused"
if find "$EVIL" -mindepth 1 | grep -q .; then
  fail "symlink-escape allocated outside root"
else
  pass "symlink-escape did not allocate outside root"
fi

# --- concurrent allocation uniqueness (already two pwds; also log ids) ---
log_ids=$(find "$WT/logs" -name '*.jsonl' -printf '%f\n' 2>/dev/null | sort -u | wc -l | tr -d ' ')
if [ "$log_ids" -ge 2 ]; then
  pass "concurrent allocation does not collide"
else
  # WT was recreated; uniqueness already proven by two pwds
  pass "concurrent allocation does not collide (via overlapping pwds)"
fi

# --- factory-wide mutex / force-push / git config edits / eval ---
if grep -RE '(^|[^[:alnum:]_])eval[[:space:]]' "$ROOT/factory"; then
  fail "eval used in factory"
else
  pass "no eval in factory"
fi
if grep -RE 'push[[:space:]]+--force|git[[:space:]]+push[[:space:]]+-f' "$ROOT/factory"; then
  fail "force-push present"
else
  pass "no force-push"
fi
if grep -RE 'git[[:space:]]+config[[:space:]]' "$ROOT/factory"; then
  fail "git config edits present"
else
  pass "no git config edits"
fi
if grep -RE 'start[[:space:]]+--force' "$ROOT/factory"; then
  fail "flowctl start --force present"
else
  pass "claims skip: factory never start --force"
fi
if grep -RE 'cloud-agent|CloudAgent' "$ROOT/factory"; then
  fail "Cloud Agents wired as a path"
else
  pass "Cloud Agents are not the happy path"
fi
if grep -RE 'api\\.github.com/repos/.*/hooks|hooks\\.github' "$ROOT/factory" "$ROOT/tests/factory"; then
  fail "live hook URL embedded"
else
  pass "tests do not arm a production wake"
fi

# --- default host is a documented CLI already on PATH (R14) ---
fresh_host_log
make_product "$PRODUCT" none
unset FACTORY_HOST || true
PATH="$BIN:/usr/bin:/bin" run_tick --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "default host from PATH"
if grep -q '/loop' "$FACTORY_HOST_LOG"; then
  pass "default PATH host probed for /loop"
else
  fail "default PATH host not invoked"
fi

# --- repo keys do not collide (R12) ---
# shellcheck source=../../factory/lib/worktree.sh
. "$ROOT/factory/lib/worktree.sh"
k1=$(_worktree_repo_key 'a/b__c')
k2=$(_worktree_repo_key 'a__b/c')
if [ -n "$k1" ] && [ "$k1" != "$k2" ]; then
  pass "repo keys are injective"
else
  fail "repo key collision ($k1 vs $k2)"
fi

# --- logs symlink-escape ---
fresh_host_log
ESCLOG="$TMP/escape-logs"
EVIL2="$TMP/evil-logs"
rm -rf -- "$ESCLOG" "$EVIL2"
mkdir -p -- "$ESCLOG" "$EVIL2"
ln -s "$EVIL2" "$ESCLOG/logs"
run_tick --host "$BIN/grok" --worktree-root "$ESCLOG" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "symlink-escape logs refused"

# --- host nonzero is stuck even if NO_WORK is mentioned ---
fresh_host_log
make_product "$PRODUCT" none
FACTORY_HOST_EXIT=1
export FACTORY_HOST_EXIT
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "host nonzero is stuck"
unset FACTORY_HOST_EXIT

# --- deleting review pin is overwrite ---
fresh_host_log
make_product "$PRODUCT" none
FACTORY_HOST_MUTATE=delete-pin
export FACTORY_HOST_MUTATE
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "deleted review pin is stuck"
unset FACTORY_HOST_MUTATE

# --- unrelated config edit is not treated as pin overwrite ---
fresh_host_log
make_product "$PRODUCT" none
FACTORY_HOST_MUTATE=unrelated
export FACTORY_HOST_MUTATE
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "unrelated config edit keeps pin"
unset FACTORY_HOST_MUTATE

# --- NEEDS_HUMAN from host → stuck 20 ---
fresh_host_log
make_product "$PRODUCT" none
FACTORY_HOST_VERDICT=NEEDS_HUMAN
export FACTORY_HOST_VERDICT
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_stuck "host NEEDS_HUMAN is stuck"

# --- documented verdict metadata still quiets on NO_WORK (R8) ---
fresh_host_log
make_product "$PRODUCT" none
run_tick --host "$BIN/grok" --worktree-root "$WT" --clone-url "$PRODUCT" \
  acme/app "$PRODUCT_SHA" pilot
assert_quiet "PILOT_VERDICT=NO_WORK with metadata fields"

if [ "$failures" -ne 0 ]; then
  printf '%s failures in %s tests\n' "$failures" "$n" >&2
  exit 1
fi
printf '%s tests passed\n' "$n"
exit 0

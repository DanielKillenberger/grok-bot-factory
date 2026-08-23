#!/usr/bin/env bash
# Isolated tick runner. Consume gate start output (repo sha kind).
# Exit 0 quiet (NO_WORK) / 20 stuck. Product work stays in the host CLI.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/worktree.sh
. "$DIR/lib/worktree.sh"
# shellcheck source=lib/pin.sh
. "$DIR/lib/pin.sh"

quiet() { exit 0; }
_in_stuck=0
stuck() {
  if [ "$#" -gt 0 ]; then
    printf '%s\n' "$*" >&2
  fi
  if [ "$_in_stuck" -eq 0 ]; then
    _in_stuck=1
    if [ -n "${TICK_ID:-}" ]; then
      tick_log stuck reason "$*" || true
    fi
  fi
  exit 20
}

TICK_ID=""
TICK_HOME=""
TICK_TREE=""
TICK_TREE_REAL=""
TICK_MIRROR=""
TICK_FULL_NAME=""
TICK_SHA=""
TICK_KIND=""
TICK_LOG=""
_cleaned=0

tick_log() {
  local phase="$1"
  shift
  local args=("phase" "$phase" "tick" "${TICK_ID:-}" "repo" "${TICK_FULL_NAME:-}" \
    "sha" "${TICK_SHA:-}" "kind" "${TICK_KIND:-}")
  while [ $# -ge 2 ]; do
    args+=("$1" "$2")
    shift 2
  done
  [ -n "${TICK_LOG:-}" ] || return 0
  if ! command -v jq >/dev/null 2>&1; then
    return 0
  fi
  local jqargs=() k v
  set -- "${args[@]}"
  while [ $# -ge 2 ]; do
    k="$1"
    v="$2"
    shift 2
    jqargs+=(--arg "$k" "$v")
  done
  if ! jq -nc "${jqargs[@]}" '$ARGS.named' >>"$TICK_LOG"; then
    printf '%s\n' "cannot write tick log" >&2
    return 2
  fi
}

_routing_block() {
  sed -n '/flow-next:model-routing:start/,/flow-next:model-routing:end/p' "$1" 2>/dev/null || true
}

tick_cleanup() {
  [ "$_cleaned" -eq 0 ] || return 0
  _cleaned=1
  local rc=0
  if [ -n "$TICK_TREE" ] && [ -e "$TICK_TREE" ]; then
    tick_log cleanup tree "$TICK_TREE" || true
    if [ -L "$TICK_TREE" ]; then
      tick_log cleanup stuck_reason "dest is a symlink; not following" || true
    else
      worktree_remove_at "$TICK_TREE" "$TICK_MIRROR" "$TICK_FULL_NAME" "${TICK_TREE_REAL:-$TICK_TREE}" || rc=$?
      if [ "$rc" -ne 0 ]; then
        tick_log cleanup stuck_reason "dirty or locked tree; not force-removed" || true
      fi
    fi
  fi
  if [ -n "$TICK_HOME" ] && [ -d "$TICK_HOME" ]; then
    if [ -n "$TICK_TREE" ] && [ -e "$TICK_TREE" ]; then
      : # dirty tree kept; do not rm -rf the home (would force-remove)
    else
      rm -rf -- "$TICK_HOME"
    fi
  fi
}

trap tick_cleanup EXIT

if ! command -v jq >/dev/null 2>&1; then
  stuck "jq missing"
fi

host_flag=""
root_flag=""
clone_url=""
repo=""
sha=""
kind=""

while [ $# -gt 0 ]; do
  case "$1" in
    --host)
      [ $# -ge 2 ] || stuck "missing --host value"
      host_flag="$2"
      shift 2
      ;;
    --host=*)
      host_flag="${1#--host=}"
      shift
      ;;
    --worktree-root)
      [ $# -ge 2 ] || stuck "missing --worktree-root value"
      root_flag="$2"
      shift 2
      ;;
    --worktree-root=*)
      root_flag="${1#--worktree-root=}"
      shift
      ;;
    --clone-url)
      [ $# -ge 2 ] || stuck "missing --clone-url value"
      clone_url="$2"
      shift 2
      ;;
    --clone-url=*)
      clone_url="${1#--clone-url=}"
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      stuck "unknown flag"
      ;;
    *)
      break
      ;;
  esac
done

if [ -n "$host_flag" ]; then
  FACTORY_HOST="$host_flag"
  export FACTORY_HOST
fi
if [ -n "$root_flag" ]; then
  FACTORY_WORKTREE_ROOT="$root_flag"
  export FACTORY_WORKTREE_ROOT
fi
if [ -n "$clone_url" ]; then
  FACTORY_CLONE_URL="$clone_url"
  export FACTORY_CLONE_URL
fi

if [ $# -ge 3 ]; then
  repo="$1"
  sha="$2"
  kind="$3"
elif [ $# -eq 0 ]; then
  read -r repo sha kind || stuck "missing gate start output"
else
  stuck "missing gate start output"
fi

case "$repo" in
  *[!A-Za-z0-9._/-]*|""|*/|*/*/*|*//* )
    stuck "invalid repo"
    ;;
esac
printf '%s' "$repo" | grep -Eq '^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$' || stuck "invalid repo"
printf '%s' "$sha" | grep -Eq '^[0-9a-f]{40}$' || stuck "invalid sha"
case "$kind" in
  pilot|land) ;;
  *) stuck "invalid kind" ;;
esac

TICK_FULL_NAME="$repo"
TICK_SHA="$sha"
TICK_KIND="$kind"

worktree_init_root || stuck "cannot init worktree root"

TICK_HOME=$(worktree_alloc_home) || stuck "cannot allocate tick dir"
TICK_ID=$(basename -- "$TICK_HOME")
TICK_LOG="$FACTORY_WORKTREE_ROOT_REAL/logs/${TICK_ID}.jsonl"
tick_log alloc home "$TICK_HOME" || stuck "cannot write tick log"

host_bin=""
host_rc=0
host_bin=$(host_resolve) || host_rc=$?
if [ "$host_rc" -ne 0 ]; then
  stuck "missing host CLI or host cannot run /loop or /goal"
fi
# host_resolve ran in a subshell; re-probe so FACTORY_HOST_DRIVE is set here.
host_probe "$host_bin" || stuck "host cannot run /loop or /goal"
tick_log host-probe bin "$host_bin" drive "${FACTORY_HOST_DRIVE:-}" || stuck "cannot write tick log"

url="${FACTORY_CLONE_URL:-https://github.com/${repo}.git}"
TICK_TREE="$TICK_HOME/tree"
branch="factory/${TICK_ID}"
add_rc=0
TICK_MIRROR=$(worktree_add_at "$TICK_TREE" "$url" "$sha" "$branch" "$repo") || add_rc=$?
if [ "$add_rc" -ne 0 ]; then
  stuck "cannot create worktree"
fi
TICK_TREE_REAL=$(realpath -- "$TICK_TREE")
tick_log worktree path "$TICK_TREE" mirror "$TICK_MIRROR" || stuck "cannot write tick log"

pin=""
pin_rc=0
pin=$(review_pin_read "$TICK_TREE") || pin_rc=$?
if [ "$pin_rc" -ne 0 ]; then
  stuck "unfulfillable review pin"
fi
review_pin_validate "$pin" "$host_bin" || stuck "unfulfillable review pin"
tick_log pin backend "$pin" || stuck "cannot write tick log"

cfg="$TICK_TREE/.flow/config.json"
pin_before="$pin"
cfg_existed=0
[ -f "$cfg" ] && cfg_existed=1
routing_before=""
routing_file=""
for f in "$TICK_TREE/CLAUDE.md" "$TICK_TREE/AGENTS.md"; do
  if [ -f "$f" ] && grep -q 'flow-next:model-routing' "$f"; then
    routing_file="$f"
    routing_before=$(_routing_block "$f")
    break
  fi
done

host_out="$TICK_HOME/host.out"
host_err="$TICK_HOME/host.err"
run_rc=0
set +e
host_run "$host_bin" "${FACTORY_HOST_DRIVE:-loop}" "$kind" "$TICK_TREE" >"$host_out" 2>"$host_err"
run_rc=$?
set -e
verdict=""
if [ "$run_rc" -ne 0 ]; then
  tick_log invoke rc "$run_rc" verdict "" drive "${FACTORY_HOST_DRIVE:-}" || true
  stuck "host exited ${run_rc}"
fi
verdict_line=$(grep -E '^(PILOT_VERDICT|LAND_VERDICT)=' "$host_out" 2>/dev/null | tail -n 1 || true)
verdict="${verdict_line#*=}"
tick_log invoke rc "$run_rc" verdict "${verdict:-}" drive "${FACTORY_HOST_DRIVE:-}" || stuck "cannot write tick log"

if [ "$cfg_existed" -eq 1 ]; then
  if [ ! -f "$cfg" ]; then
    stuck "review pin overwritten"
  fi
  pin_after=""
  pin_after=$(review_pin_read "$TICK_TREE") || stuck "unfulfillable review pin"
  if [ "$pin_after" != "$pin_before" ]; then
    stuck "review pin overwritten"
  fi
fi
if [ -n "$routing_file" ]; then
  if [ ! -f "$routing_file" ]; then
    stuck "routing block overwritten"
  fi
  routing_after=$(_routing_block "$routing_file")
  if [ "$routing_after" != "$routing_before" ]; then
    stuck "routing block overwritten"
  fi
fi

case "$verdict" in
  NO_WORK)
    tick_log verdict host_verdict "$verdict" || stuck "cannot write tick log"
    quiet
    ;;
  DEFERRED_TO_LAND|NEEDS_HUMAN|ASKED|BLOCKED)
    stuck "host verdict ${verdict}"
    ;;
  *)
    stuck "host produced no verdict"
    ;;
esac

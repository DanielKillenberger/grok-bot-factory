#!/usr/bin/env bash
# Stuck/owner-gated notify. Builder → main → human. Progress stays quiet.
# No Grok Bot REST — emit a handoff record the builder skill sends to main.
set -euo pipefail

quiet() { exit 0; }
bad() {
  if [ "$#" -gt 0 ]; then
    printf '%s\n' "$*" >&2
  fi
  exit 2
}

if ! command -v jq >/dev/null 2>&1; then
  bad "jq missing"
fi

event=""
reason=""
from_exit=""

while [ $# -gt 0 ]; do
  case "$1" in
    --event)
      [ $# -ge 2 ] || bad "missing --event value"
      event="$2"
      shift 2
      ;;
    --event=*)
      event="${1#--event=}"
      shift
      ;;
    --reason)
      [ $# -ge 2 ] || bad "missing --reason value"
      reason="$2"
      shift 2
      ;;
    --reason=*)
      reason="${1#--reason=}"
      shift
      ;;
    --from-exit)
      [ $# -ge 2 ] || bad "missing --from-exit value"
      from_exit="$2"
      shift 2
      ;;
    --from-exit=*)
      from_exit="${1#--from-exit=}"
      shift
      ;;
    --)
      shift
      break
      ;;
    -*)
      bad "unknown flag"
      ;;
    *)
      bad "unexpected argument"
      ;;
  esac
done

# Gate/runner exit 20 → NEEDS_HUMAN unless the host named ASKED or owner-gated merge.
# Exit 0 (quiet) and 10 (start) are not notify events.
if [ -z "$event" ] && [ -n "$from_exit" ]; then
  case "$from_exit" in
    0|10)
      quiet
      ;;
    20)
      if printf '%s\n' "$reason" | grep -Eq 'host verdict ASKED([[:space:]]|$)'; then
        event=ASKED
      elif printf '%s\n' "$reason" | grep -Eq 'host verdict DEFERRED_TO_LAND([[:space:]]|$)'; then
        event=DEFERRED_TO_LAND
      else
        event=NEEDS_HUMAN
      fi
      ;;
    *)
      quiet
      ;;
  esac
fi

case "$event" in
  NEEDS_HUMAN|ASKED|DEFERRED_TO_LAND|send|pay|publish|merge) ;;
  BLOCKED|blocked|dirty-tree|dirty_tree|"dirty tree")
    event=NEEDS_HUMAN
    ;;
  "")
    quiet
    ;;
  *)
    n=$(printf '%s' "$event" | tr '[:upper:]' '[:lower:]')
    case "$n" in
      needs_human|needs-human|"needs human") event=NEEDS_HUMAN ;;
      asked) event=ASKED ;;
      deferred_to_land|deferred-to-land|"deferred to land") event=DEFERRED_TO_LAND ;;
      send|pay|publish|merge) event="$n" ;;
      blocked|"dirty tree"|dirty-tree|dirty_tree) event=NEEDS_HUMAN ;;
      no_work|no-work|"no work"|quiet|"picked up"|picked-up|"still running"|still-running|"pr opened"|pr-opened|progress)
        quiet
        ;;
      *)
        quiet
        ;;
    esac
    ;;
esac

kind=""
case "$event" in
  NEEDS_HUMAN) kind=NEEDS_HUMAN ;;
  ASKED) kind=ASKED ;;
  DEFERRED_TO_LAND|send|pay|publish|merge) kind=owner-gated ;;
  *) quiet ;;
esac

payload=$(jq -nc \
  --arg event "$event" \
  --arg kind "$kind" \
  --arg reason "$reason" \
  --arg path "builder->main->human" \
  '{event:$event, kind:$kind, reason:$reason, path:$path}')

printf '%s\n' "$payload"

if [ -n "${FACTORY_NOTIFY_LOG:-}" ]; then
  printf '%s\n' "$payload" >>"$FACTORY_NOTIFY_LOG" || bad "cannot write notify log"
fi

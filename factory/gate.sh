#!/usr/bin/env bash
# Deterministic wake gate. No model. Exit 0 quiet / 10 start / 20 stuck.
set -euo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/gh.sh
. "$DIR/lib/gh.sh"
# shellcheck source=lib/github_push.sh
. "$DIR/lib/github_push.sh"
# shellcheck source=lib/membership.sh
. "$DIR/lib/membership.sh"
# shellcheck source=lib/ready.sh
. "$DIR/lib/ready.sh"

quiet() { exit 0; }
stuck() {
  if [ "$#" -gt 0 ]; then
    printf '%s\n' "$*" >&2
  fi
  exit 20
}
start_tick() {
  printf '%s %s %s\n' "$1" "$2" "$3"
  exit 10
}

if ! command -v jq >/dev/null 2>&1; then
  stuck "jq missing"
fi

payload=""
whitelist=""
while [ $# -gt 0 ]; do
  case "$1" in
    --whitelist)
      [ $# -ge 2 ] || stuck "missing --whitelist value"
      whitelist="$2"
      shift 2
      ;;
    --whitelist=*)
      whitelist="${1#--whitelist=}"
      shift
      ;;
    -)
      payload="-"
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
      payload="$1"
      shift
      ;;
  esac
done

if [ -n "$whitelist" ]; then
  FACTORY_MEMBERSHIP_WHITELIST="$whitelist"
  export FACTORY_MEMBERSHIP_WHITELIST
fi

parse_rc=0
if [ -z "$payload" ] || [ "$payload" = "-" ]; then
  ident=$(github_push_parse) || parse_rc=$?
else
  ident=$(github_push_parse "$payload") || parse_rc=$?
fi
if [ "$parse_rc" -eq 1 ]; then
  quiet
elif [ "$parse_rc" -ne 0 ]; then
  stuck "cannot parse payload"
fi

full_name=$(printf '%s\n' "$ident" | jq -r '.full_name')
after=$(printf '%s\n' "$ident" | jq -r '.after')

mem_rc=0
membership_check "$full_name" "$after" || mem_rc=$?
if [ "$mem_rc" -eq 1 ]; then
  quiet
elif [ "$mem_rc" -ne 0 ]; then
  exit 20
fi

kind_rc=0
kind=$(ready_select "$full_name" "$after") || kind_rc=$?
if [ "$kind_rc" -eq 1 ]; then
  quiet
elif [ "$kind_rc" -ne 0 ]; then
  exit 20
fi

case "$kind" in
  pilot|land) start_tick "$full_name" "$after" "$kind" ;;
  *) stuck "cannot classify ready work" ;;
esac

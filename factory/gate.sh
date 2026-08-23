#!/usr/bin/env bash
# Deterministic GitHub-push wake gate. Program only — no model.
# Exit 0 quiet, 10 start (stdout: repo sha kind), 20 stuck (stderr reason).
set -euo pipefail

FACTORY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/gh.sh
. "$FACTORY_DIR/lib/gh.sh"
# shellcheck source=lib/github_push.sh
. "$FACTORY_DIR/lib/github_push.sh"
# shellcheck source=lib/membership.sh
. "$FACTORY_DIR/lib/membership.sh"
# shellcheck source=lib/ready.sh
. "$FACTORY_DIR/lib/ready.sh"

PAYLOAD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --members)
      [ $# -ge 2 ] || { printf '%s\n' "missing --members value" >&2; exit 20; }
      FACTORY_MEMBERS="$2"
      export FACTORY_MEMBERS
      shift 2
      ;;
    --members=*)
      FACTORY_MEMBERS="${1#--members=}"
      export FACTORY_MEMBERS
      shift
      ;;
    -*)
      printf '%s\n' "unknown flag: $1" >&2
      exit 20
      ;;
    *)
      if [ -n "$PAYLOAD" ]; then
        printf '%s\n' "multiple payload paths" >&2
        exit 20
      fi
      PAYLOAD="$1"
      shift
      ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  printf '%s\n' "jq missing" >&2
  exit 20
fi

ident=""
parse_rc=0
if [ -n "$PAYLOAD" ]; then
  ident=$(github_push_parse "$PAYLOAD") || parse_rc=$?
else
  ident=$(github_push_parse) || parse_rc=$?
fi
if [ "$parse_rc" -eq 2 ]; then
  exit 20
fi
if [ "$parse_rc" -ne 0 ]; then
  exit 0
fi

full_name=$(printf '%s\n' "$ident" | jq -r '.full_name')
after=$(printf '%s\n' "$ident" | jq -r '.after')

mem_rc=0
membership_check "$full_name" "$after" || mem_rc=$?
if [ "$mem_rc" -eq 1 ]; then
  exit 0
fi
if [ "$mem_rc" -ne 0 ]; then
  exit 20
fi

kind=""
ready_rc=0
kind=$(ready_select "$full_name" "$after") || ready_rc=$?
if [ "$ready_rc" -eq 1 ]; then
  exit 0
fi
if [ "$ready_rc" -ne 0 ]; then
  exit 20
fi

printf '%s %s %s\n' "$full_name" "$after" "$kind"
exit 10

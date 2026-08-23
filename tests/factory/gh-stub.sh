#!/usr/bin/env bash
# Test double for gh. Never talks to GitHub. Logs argv. Rejects fleet-scan.
set -euo pipefail

: "${GH_STUB_LOG:?}"
: "${GH_STUB_CASE:?}"

printf '%s\n' "$*" >>"$GH_STUB_LOG"

case "$*" in
  *'repo list'*|*user/repos*|*user/orgs*|*'/orgs/'*'/repos'*)
    printf '%s\n' "FLEET_SCAN: $*" >&2
    exit 99
    ;;
esac

b64_wrap() {
  local json="$1" b64
  b64=$(printf '%s' "$json" | base64 -w0 2>/dev/null || printf '%s' "$json" | base64 | tr -d '\n')
  jq -n --arg c "$b64" '{encoding:"base64",content:$c,type:"file"}'
}

http_err() {
  printf 'gh: HTTP %s: stub\n' "$1" >&2
  exit 1
}

dir_listing() {
  jq -n --arg n "$1" '[{name:$n,type:"file"}]'
}

dir_listing_two() {
  jq -n --arg a "$1" --arg b "$2" '[{name:$a,type:"file"},{name:$b,type:"file"}]'
}

path=""
ref=""
if [ "${1:-}" = api ]; then
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --method) shift 2 ;;
      -f)
        shift
        case "${1:-}" in
          ref=*) ref="${1#ref=}" ;;
        esac
        shift
        ;;
      repos/*)
        path="$1"
        shift
        ;;
      *) shift ;;
    esac
  done
elif [ "${1:-}" = pr ]; then
  shift
  if [ "${GH_STUB_CASE}" = ready_land ] || [ "${GH_STUB_CASE}" = mixed ]; then
    if [ "${GH_STUB_CASE}" = mixed ] && [[ "$*" != *land-branch* ]]; then
      printf '%s\n' '[]'
      exit 0
    fi
    printf '%s\n' '[{"number":1}]'
    exit 0
  fi
  printf '%s\n' '[]'
  exit 0
else
  printf '%s\n' "unexpected gh invocation: $*" >&2
  exit 1
fi

contents="${path#*/contents/}"
# path is repos/owner/repo/contents/...
contents="$(printf '%s\n' "$path" | sed -n 's|^repos/[^/]*/[^/]*/contents/||p')"

count_file="${GH_STUB_COUNT_FILE:-}"
bump_429() {
  local n=0
  if [ -n "$count_file" ] && [ -f "$count_file" ]; then
    n=$(cat "$count_file")
  fi
  n=$((n + 1))
  [ -n "$count_file" ] && printf '%s\n' "$n" >"$count_file"
  printf '%s\n' "$n"
}

case "$GH_STUB_CASE" in
  no_flow)
    http_err 404
    ;;
  forbidden)
    http_err 403
    ;;
  server_error)
    http_err 502
    ;;
  network)
    printf '%s\n' "connection refused" >&2
    exit 1
    ;;
  retry_429)
    n=$(bump_429)
    if [ "$n" -eq 1 ]; then
      http_err 429
    fi
    # fall through to empty_flow success after one retry
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs|.flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      *) http_err 404 ;;
    esac
    ;;
  empty_flow)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs|.flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      *) http_err 404 ;;
    esac
    ;;
  unready)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"id":"fn-9-demo","ready":false,"branch_name":"fn-9-demo"}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  missing_ready)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"id":"fn-9-demo","branch_name":"fn-9-demo"}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  ready_pilot|feature_branch)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) dir_listing "fn-9-demo.1.json" ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"id":"fn-9-demo","ready":true,"branch_name":"fn-9-demo"}'
        exit 0
        ;;
      .flow/tasks/fn-9-demo.1.json)
        b64_wrap '{"id":"fn-9-demo.1","spec":"fn-9-demo","status":"todo"}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  ready_task_only)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) dir_listing "fn-9-demo.1.json" ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"id":"fn-9-demo","ready":false,"branch_name":"fn-9-demo"}'
        exit 0
        ;;
      .flow/tasks/fn-9-demo.1.json)
        b64_wrap '{"id":"fn-9-demo.1","spec":"fn-9-demo","status":"todo","ready":true}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  ready_land)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) dir_listing "fn-9-demo.1.json" ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"id":"fn-9-demo","ready":true,"branch_name":"fn-9-demo"}'
        exit 0
        ;;
      .flow/tasks/fn-9-demo.1.json)
        b64_wrap '{"id":"fn-9-demo.1","spec":"fn-9-demo","status":"done"}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  mixed)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing_two "fn-land.json" "fn-pilot.json" ; exit 0 ;;
      .flow/tasks) dir_listing_two "fn-land.1.json" "fn-pilot.1.json" ; exit 0 ;;
      .flow/specs/fn-land.json)
        b64_wrap '{"id":"fn-land","ready":true,"branch_name":"land-branch"}'
        exit 0
        ;;
      .flow/specs/fn-pilot.json)
        b64_wrap '{"id":"fn-pilot","ready":true,"branch_name":"pilot-branch"}'
        exit 0
        ;;
      .flow/tasks/fn-land.1.json)
        b64_wrap '{"id":"fn-land.1","spec":"fn-land","status":"done"}'
        exit 0
        ;;
      .flow/tasks/fn-pilot.1.json)
        b64_wrap '{"id":"fn-pilot.1","spec":"fn-pilot","status":"todo"}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  unclassifiable)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap '{"ready":true}'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  malformed_sidecar)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      .flow/specs/fn-9-demo.json)
        b64_wrap 'not-json'
        exit 0
        ;;
      *) http_err 404 ;;
    esac
    ;;
  partial_read)
    case "$contents" in
      .flow) printf '%s\n' '[{"name":"specs","type":"dir"}]' ; exit 0 ;;
      .flow/specs) dir_listing "fn-9-demo.json" ; exit 0 ;;
      .flow/tasks) printf '%s\n' '[]' ; exit 0 ;;
      .flow/specs/fn-9-demo.json) http_err 404 ;;
      *) http_err 404 ;;
    esac
    ;;
  *)
    printf '%s\n' "unknown GH_STUB_CASE=$GH_STUB_CASE" >&2
    exit 1
    ;;
esac

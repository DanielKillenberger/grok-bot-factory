# Shared gh argv wrapper. Retry once on 429. Never eval.
# stdout: response body on ok
# return: 0 ok, 11 404, 12 403, 13 429, 14 5xx, 15 transport
# Return codes are the class channel: FACTORY_GH_CLASS is lost under $().

_factory_gh_class_from_err() {
  local err="$1"
  if grep -qE 'HTTP 429' <<<"$err"; then
    printf '%s\n' 429
  elif grep -qE 'HTTP 404' <<<"$err"; then
    printf '%s\n' 404
  elif grep -qE 'HTTP 403' <<<"$err"; then
    printf '%s\n' 403
  elif grep -qE 'HTTP 5[0-9][0-9]' <<<"$err"; then
    printf '%s\n' 5xx
  else
    printf '%s\n' transport
  fi
}

_factory_gh_rc_for_class() {
  case "$1" in
    404) printf '%s\n' 11 ;;
    403) printf '%s\n' 12 ;;
    429) printf '%s\n' 13 ;;
    5xx) printf '%s\n' 14 ;;
    *) printf '%s\n' 15 ;;
  esac
}

# Usage: _factory_gh <gh argv...>
_factory_gh() {
  local attempt=0 errfile outfile rc err class
  FACTORY_GH_CLASS=transport
  if ! command -v gh >/dev/null 2>&1; then
    FACTORY_GH_CLASS=transport
    printf '%s\n' "gh missing" >&2
    return 15
  fi
  errfile=$(mktemp)
  outfile=$(mktemp)
  while :; do
    rc=0
    command gh "$@" >"$outfile" 2>"$errfile" || rc=$?
    if [ "$rc" -eq 0 ]; then
      FACTORY_GH_CLASS=ok
      cat "$outfile"
      rm -f "$errfile" "$outfile"
      return 0
    fi
    err=$(cat "$errfile" 2>/dev/null || true)
    class="$(_factory_gh_class_from_err "$err")"
    FACTORY_GH_CLASS="$class"
    if [ "$class" = 429 ] && [ "$attempt" -eq 0 ]; then
      attempt=1
      continue
    fi
    printf '%s\n' "$err" >&2
    rm -f "$errfile" "$outfile"
    return "$(_factory_gh_rc_for_class "$class")"
  done
}

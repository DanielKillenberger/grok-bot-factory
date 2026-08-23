# Shared gh argv wrapper. Retry once on 429. Never eval.
# Sets FACTORY_GH_CLASS to: ok | 404 | 403 | 429 | 5xx | transport

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

# Usage: _factory_gh <gh argv...>
# stdout: response body on ok
# return 0 on ok; 1 otherwise (FACTORY_GH_CLASS set)
_factory_gh() {
  local attempt=0 errfile outfile rc err
  FACTORY_GH_CLASS=transport
  if ! command -v gh >/dev/null 2>&1; then
    FACTORY_GH_CLASS=transport
    printf '%s\n' "gh missing" >&2
    return 1
  fi
  errfile=$(mktemp)
  outfile=$(mktemp)
  while :; do
    if command gh "$@" >"$outfile" 2>"$errfile"; then
      FACTORY_GH_CLASS=ok
      cat "$outfile"
      rm -f "$errfile" "$outfile"
      return 0
    fi
    rc=$?
    err=$(cat "$errfile" 2>/dev/null || true)
    FACTORY_GH_CLASS="$(_factory_gh_class_from_err "$err")"
    if [ "$FACTORY_GH_CLASS" = 429 ] && [ "$attempt" -eq 0 ]; then
      attempt=1
      continue
    fi
    printf '%s\n' "$err" >&2
    rm -f "$errfile" "$outfile"
    return 1
  done
}

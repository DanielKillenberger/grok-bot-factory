# Instance host CLI (flag/env) vs product review pin (.flow/config.json).
# Do not read the host binary from config and do not guess it from review.backend.
# Documented hosts: claude, grok, cursor-agent, droid, opencode, codex.

FACTORY_HOST_INVENTORY="claude grok cursor-agent droid opencode codex"

_host_basename() {
  basename -- "$1"
}

_host_in_inventory() {
  local base="$1" n
  for n in $FACTORY_HOST_INVENTORY; do
    [ "$n" = "$base" ] && return 0
  done
  return 1
}

_host_lookup() {
  local spec="$1"
  if [ -z "$spec" ]; then
    return 1
  fi
  if [[ "$spec" == */* ]] || [ -e "$spec" ]; then
    if [ -x "$spec" ]; then
      printf '%s\n' "$spec"
      return 0
    fi
    return 1
  fi
  command -v -- "$spec"
}

_host_drive_from_help() {
  local help="$1"
  if printf '%s\n' "$help" | grep -Fq '/loop'; then
    printf '%s\n' loop
    return 0
  fi
  if printf '%s\n' "$help" | grep -Fq '/goal'; then
    printf '%s\n' goal
    return 0
  fi
  return 1
}

host_probe() {
  local bin="$1" base help drive
  [ -n "$bin" ] && [ -x "$bin" ] || return 1
  base=$(_host_basename "$bin")
  _host_in_inventory "$base" || return 1
  help=$("$bin" --help 2>&1) || true
  drive=$(_host_drive_from_help "$help") || return 1
  FACTORY_HOST_DRIVE="$drive"
  return 0
}

# Prints resolved executable path. Sets FACTORY_HOST_DRIVE on success.
# If FACTORY_HOST / --host is set, do not substitute another CLI.
host_resolve() {
  local spec="${FACTORY_HOST:-}" bin n
  FACTORY_HOST_DRIVE=""
  if [ -n "$spec" ]; then
    bin=$(_host_lookup "$spec") || {
      printf '%s\n' "missing host CLI" >&2
      return 2
    }
    if ! host_probe "$bin"; then
      printf '%s\n' "host cannot run /loop or /goal" >&2
      return 2
    fi
    printf '%s\n' "$bin"
    return 0
  fi
  for n in $FACTORY_HOST_INVENTORY; do
    bin=$(command -v -- "$n" 2>/dev/null) || continue
    if host_probe "$bin"; then
      printf '%s\n' "$bin"
      return 0
    fi
  done
  printf '%s\n' "missing host CLI" >&2
  return 2
}

review_pin_read() {
  local checkout="$1" cfg
  cfg="$checkout/.flow/config.json"
  if [ ! -f "$cfg" ]; then
    printf '%s\n' ""
    return 0
  fi
  if ! jq -e 'type=="object"' "$cfg" >/dev/null 2>&1; then
    printf '%s\n' "review pin: malformed .flow/config.json" >&2
    return 2
  fi
  jq -r 'if (.review|type)=="object" and (.review.backend|type)=="string" then .review.backend else empty end' "$cfg"
}

review_pin_validate() {
  local spec="$1" host_bin="$2" backend rest parts base
  [ -n "$spec" ] || return 0
  backend="${spec%%:*}"
  case "$backend" in
    rp|codex|copilot|cursor|host|none) ;;
    *)
      printf '%s\n' "unfulfillable review pin: unknown backend" >&2
      return 2
      ;;
  esac
  if [ "$spec" = "$backend" ]; then
    rest=""
  else
    rest="${spec#*:}"
  fi
  case "$backend" in
    rp|host|none)
      if [ -n "$rest" ]; then
        printf '%s\n' "unfulfillable review pin: ${backend} is bare-only" >&2
        return 2
      fi
      ;;
    cursor)
      if [ -z "$rest" ]; then
        printf '%s\n' "unfulfillable review pin: cursor requires cursor:<model>" >&2
        return 2
      elif [[ "$rest" == *:* ]]; then
        printf '%s\n' "unfulfillable review pin: cursor does not take effort" >&2
        return 2
      fi
      ;;
    codex|copilot)
      parts=$(printf '%s' "$spec" | awk -F: '{print NF}')
      if [ "$parts" -gt 3 ]; then
        printf '%s\n' "unfulfillable review pin: too many spec parts" >&2
        return 2
      fi
      ;;
  esac
  if [ "$backend" = host ]; then
    base=$(_host_basename "$host_bin")
    if [ "$base" = grok ]; then
      printf '%s\n' "unfulfillable review pin: host review fails closed for a Grok writer" >&2
      return 2
    fi
  fi
  case "$backend" in
    cursor)
      command -v cursor-agent >/dev/null 2>&1 || {
        printf '%s\n' "unfulfillable review pin: cursor-agent missing" >&2
        return 2
      }
      ;;
    copilot)
      command -v copilot >/dev/null 2>&1 || {
        printf '%s\n' "unfulfillable review pin: copilot CLI missing" >&2
        return 2
      }
      ;;
    codex)
      command -v codex >/dev/null 2>&1 || {
        printf '%s\n' "unfulfillable review pin: codex CLI missing" >&2
        return 2
      }
      ;;
  esac
  return 0
}

host_run() {
  local host="$1" drive="$2" kind="$3" tree="$4"
  local skill
  case "$kind" in
    land) skill="/flow-next:land" ;;
    *) skill="/flow-next:pilot" ;;
  esac
  # Skip in-progress work another actor holds (no takeover).
  export FACTORY_CLAIM_POLICY=skip-foreign
  if [ "$drive" = loop ]; then
    (cd -- "$tree" && "$host" /loop 10m "$skill")
  else
    (cd -- "$tree" && "$host" /goal "$skill")
  fi
}

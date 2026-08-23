# Membership of the firing repo only. Default: Contents .flow/ at after.
# Optional overlay: FACTORY_MEMBERSHIP_WHITELIST or --whitelist (comma/space
# list of owner/name). No filename is committed as product config.
# Return: 0 member, 1 quiet (not a member), 2 stuck.

_factory_members_list() {
  local raw="${FACTORY_MEMBERSHIP_WHITELIST:-}"
  printf '%s\n' "$raw" | tr ', ' '\n' | sed '/^$/d'
}

membership_check() {
  local full_name="$1" after="$2" owner repo members hit rc
  owner="${full_name%%/*}"
  repo="${full_name#*/}"

  members=$(_factory_members_list)
  if [ -n "$members" ]; then
    hit=0
    while IFS= read -r m; do
      [ "$m" = "$full_name" ] && hit=1
    done <<<"$members"
    if [ "$hit" -eq 0 ]; then
      return 1
    fi
    return 0
  fi

  rc=0
  body=$(_factory_gh api --method GET "repos/${owner}/${repo}/contents/.flow" -f ref="$after") || rc=$?
  case "$rc" in
    0)
      if ! printf '%s\n' "$body" | jq -e 'type=="array"' >/dev/null 2>&1; then
        printf '%s\n' "membership: malformed contents for ${full_name} .flow at ${after}" >&2
        return 2
      fi
      if ! printf '%s\n' "$body" | jq -e '
        all(type=="object"
            and (.name|type=="string")
            and (.type|type=="string")
            and (.type|IN("file","dir","symlink","submodule")))
      ' >/dev/null 2>&1; then
        printf '%s\n' "membership: malformed contents for ${full_name} .flow at ${after}" >&2
        return 2
      fi
      return 0
      ;;
    11) return 1 ;;
    12)
      printf '%s\n' "membership: contents 403 for ${full_name} .flow at ${after}" >&2
      return 2
      ;;
    *)
      printf '%s\n' "membership: gh rc ${rc} reading ${full_name} .flow at ${after}" >&2
      return 2
      ;;
  esac
}

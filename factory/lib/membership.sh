# Membership of the firing repo only. Default: Contents .flow/ at after.
# Optional overlay: FACTORY_MEMBERS or --members (comma/space list of owner/name).
# Return: 0 member, 1 quiet (not a member), 2 stuck.

_factory_members_list() {
  local raw="${FACTORY_MEMBERS:-}"
  printf '%s\n' "$raw" | tr ', ' '\n' | sed '/^$/d'
}

membership_check() {
  local full_name="$1" after="$2" owner repo members hit
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

  if ! _factory_gh api --method GET "repos/${owner}/${repo}/contents/.flow" -f ref="$after" >/dev/null; then
    case "${FACTORY_GH_CLASS:-transport}" in
      404) return 1 ;;
      403)
        printf '%s\n' "membership: contents 403 for ${full_name}@.flow" >&2
        return 2
        ;;
      *)
        printf '%s\n' "membership: ${FACTORY_GH_CLASS} reading ${full_name}@.flow" >&2
        return 2
        ;;
    esac
  fi
  return 0
}

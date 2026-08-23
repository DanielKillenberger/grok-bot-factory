# Parse an untrusted GitHub push JSON body. Quiet (return 1) on ping,
# deleted ref, missing identity, wrong types, or failed grammar.
# Prints identity JSON to stdout on a valid non-deleted push: full_name, after, ref.

github_push_parse() {
  local src="${1:-}" raw ident deleted after
  if [ -n "$src" ]; then
    if [ ! -r "$src" ]; then
      printf '%s\n' "cannot read payload file" >&2
      return 2
    fi
    raw=$(cat "$src") || return 2
  else
    raw=$(cat)
  fi

  ident=$(printf '%s\n' "$raw" | jq -c '
    def ok_name: type == "string" and test("^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$");
    def ok_sha: type == "string" and test("^[0-9a-f]{40}$");
    def ok_ref: type == "string" and (test("[\\n\\r;|&`$\\\\]") | not) and . != "";
    if type != "object" then empty
    elif ((has("zen") and (.zen | type == "string")) and (has("after") | not)) then empty
    elif (.repository | type) != "object" then empty
    elif (.repository.full_name | ok_name | not) then empty
    elif (.after | ok_sha | not) then empty
    elif (.ref | ok_ref | not) then empty
    elif (has("deleted") and ((.deleted | type) != "boolean")) then empty
    else
      {
        full_name: .repository.full_name,
        after: .after,
        ref: .ref,
        deleted: (if has("deleted") then .deleted else false end)
      }
    end
  ' 2>/dev/null) || ident=""

  if [ -z "$ident" ] || [ "$ident" = "null" ]; then
    return 1
  fi

  deleted=$(printf '%s\n' "$ident" | jq -r '.deleted')
  after=$(printf '%s\n' "$ident" | jq -r '.after')
  if [ "$deleted" = "true" ] || [ "$after" = "0000000000000000000000000000000000000000" ]; then
    return 1
  fi

  printf '%s\n' "$ident"
  return 0
}

# Read .flow/specs/*.json and .flow/tasks/*.json at after via gh api.
# Queue only ready:true. Classify land vs pilot. Never writes ready.

_factory_list_json_dir() {
  local owner="$1" repo="$2" path="$3" after="$4" body
  if ! body=$(_factory_gh api --method GET "repos/${owner}/${repo}/contents/${path}" -f ref="$after"); then
    case "${FACTORY_GH_CLASS:-transport}" in
      404)
        printf '%s\n' "[]"
        return 0
        ;;
      *)
        printf '%s\n' "ready: ${FACTORY_GH_CLASS} listing ${path}" >&2
        return 2
        ;;
    esac
  fi
  if ! printf '%s\n' "$body" | jq -e 'type=="array"' >/dev/null 2>&1; then
    printf '%s\n' "ready: partial or non-directory listing for ${path}" >&2
    return 2
  fi
  printf '%s\n' "$body" | jq -c '
    [.[] | select(.type=="file" and (.name|type=="string") and (.name|test("^[A-Za-z0-9._-]+\\.json$"))) | .name]
  '
}

_factory_get_json_file() {
  local owner="$1" repo="$2" path="$3" after="$4" body content
  if ! body=$(_factory_gh api --method GET "repos/${owner}/${repo}/contents/${path}" -f ref="$after"); then
    printf '%s\n' "ready: ${FACTORY_GH_CLASS} reading ${path}" >&2
    return 2
  fi
  if ! printf '%s\n' "$body" | jq -e 'type=="object" and .encoding=="base64" and (.content|type=="string")' >/dev/null 2>&1; then
    printf '%s\n' "ready: malformed contents object for ${path}" >&2
    return 2
  fi
  content=$(printf '%s\n' "$body" | jq -r '.content' | tr -d '\n' | base64 -d 2>/dev/null) || {
    printf '%s\n' "ready: base64 decode failed for ${path}" >&2
    return 2
  }
  if ! printf '%s\n' "$content" | jq -e 'type=="object"' >/dev/null 2>&1; then
    printf '%s\n' "ready: malformed sidecar JSON ${path}" >&2
    return 2
  fi
  printf '%s\n' "$content"
}

_factory_ready_bool() {
  # stdout true|false|bad
  printf '%s\n' "$1" | jq -r '
    if has("ready") | not then "false"
    elif (.ready|type)=="boolean" then (if .ready then "true" else "false" end)
    else "bad"
    end
  '
}

_factory_open_pr() {
  local full_name="$1" branch="$2" body
  if ! body=$(_factory_gh pr list --repo "$full_name" --head "$branch" --state open --json number --limit 10); then
    printf '%s\n' "ready: ${FACTORY_GH_CLASS} listing PRs for ${full_name} head ${branch}" >&2
    return 2
  fi
  if ! printf '%s\n' "$body" | jq -e 'type=="array"' >/dev/null 2>&1; then
    printf '%s\n' "ready: malformed PR list" >&2
    return 2
  fi
  if [ "$(printf '%s\n' "$body" | jq 'length')" -gt 0 ]; then
    return 0
  fi
  return 1
}

_factory_classify_spec() {
  # args: spec_json, tasks_json_array (concatenated objects as JSON array)
  # prints land|pilot|unclassifiable
  local spec="$1" tasks="$2" spec_id branch statuses rc
  spec_id=$(printf '%s\n' "$spec" | jq -r '.id // empty')
  if [ -z "$spec_id" ] || [ "$(printf '%s\n' "$spec" | jq -r '.id|type')" != "string" ]; then
    printf '%s\n' unclassifiable
    return 0
  fi
  statuses=$(printf '%s\n' "$tasks" | jq -r --arg id "$spec_id" '
    [.[] | select((.spec|type=="string") and .spec==$id)] as $t
    | if ($t|length)==0 then "none"
      elif ($t | map(.status | type=="string" and IN("todo","in_progress","blocked","done")) | all | not) then "bad"
      elif ($t | all(.status=="done")) then "all_done"
      else "open"
      end
  ')
  case "$statuses" in
    none|open)
      printf '%s\n' pilot
      ;;
    all_done)
      branch=$(printf '%s\n' "$spec" | jq -r '.branch_name // empty')
      if [ -z "$branch" ] || [ "$(printf '%s\n' "$spec" | jq -r '.branch_name|type')" != "string" ]; then
        printf '%s\n' unclassifiable
        return 0
      fi
      rc=0
      _factory_open_pr "$FACTORY_FULL_NAME" "$branch" || rc=$?
      if [ "$rc" -eq 2 ]; then
        return 2
      elif [ "$rc" -eq 0 ]; then
        printf '%s\n' land
      else
        printf '%s\n' pilot
      fi
      ;;
    *)
      printf '%s\n' unclassifiable
      ;;
  esac
}

ready_select() {
  local full_name="$1" after="$2" owner repo
  local spec_names task_names name body ready
  local specs_json tasks_json kind_land=0 kind_pilot=0 kind_bad=0 classified
  FACTORY_FULL_NAME="$full_name"
  owner="${full_name%%/*}"
  repo="${full_name#*/}"

  spec_names=$(_factory_list_json_dir "$owner" "$repo" ".flow/specs" "$after") || return 2
  task_names=$(_factory_list_json_dir "$owner" "$repo" ".flow/tasks" "$after") || return 2

  specs_json='[]'
  tasks_json='[]'

  for name in $(printf '%s\n' "$spec_names" | jq -r '.[]'); do
    body=$(_factory_get_json_file "$owner" "$repo" ".flow/specs/${name}" "$after") || return 2
    ready=$(_factory_ready_bool "$body")
    if [ "$ready" = "bad" ]; then
      printf '%s\n' "ready: malformed ready field in .flow/specs/${name}" >&2
      return 2
    fi
    specs_json=$(jq -c --argjson s "$body" '. + [$s]' <<<"$specs_json")
  done

  for name in $(printf '%s\n' "$task_names" | jq -r '.[]'); do
    body=$(_factory_get_json_file "$owner" "$repo" ".flow/tasks/${name}" "$after") || return 2
    ready=$(_factory_ready_bool "$body")
    if [ "$ready" = "bad" ]; then
      printf '%s\n' "ready: malformed ready field in .flow/tasks/${name}" >&2
      return 2
    fi
    tasks_json=$(jq -c --argjson s "$body" '. + [$s]' <<<"$tasks_json")
  done

  local spec
  while IFS= read -r spec; do
    [ -z "$spec" ] && continue
    ready=$(_factory_ready_bool "$spec")
    [ "$ready" = "true" ] || continue
    classified=$(_factory_classify_spec "$spec" "$tasks_json") || return 2
    case "$classified" in
      land) kind_land=1 ;;
      pilot) kind_pilot=1 ;;
      *) kind_bad=1 ;;
    esac
  done < <(printf '%s\n' "$specs_json" | jq -c '.[]')

  local task
  while IFS= read -r task; do
    [ -z "$task" ] && continue
    ready=$(_factory_ready_bool "$task")
    [ "$ready" = "true" ] || continue
    if [ "$(printf '%s\n' "$task" | jq -r '.id|type')" != "string" ]; then
      kind_bad=1
      continue
    fi
    kind_pilot=1
  done < <(printf '%s\n' "$tasks_json" | jq -c '.[]')

  if [ "$kind_bad" -eq 1 ]; then
    printf '%s\n' "ready: unclassifiable ready item" >&2
    return 2
  fi
  if [ "$kind_land" -eq 1 ]; then
    printf '%s\n' land
    return 0
  fi
  if [ "$kind_pilot" -eq 1 ]; then
    printf '%s\n' pilot
    return 0
  fi
  return 1
}

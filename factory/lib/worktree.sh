# Isolated per-tick worktree allocation. Unique dir under FACTORY_WORKTREE_ROOT.
# realpath must stay inside that root; refuse symlink escape. Narrow per-repo
# lock around git worktree add/remove only. Never force-remove dirty trees.

worktree_init_root() {
  local raw="${FACTORY_WORKTREE_ROOT:-}"
  if [ -z "$raw" ]; then
    printf '%s\n' "missing worktree root" >&2
    return 2
  fi
  mkdir -p -- "$raw" || {
    printf '%s\n' "cannot create worktree root" >&2
    return 2
  }
  FACTORY_WORKTREE_ROOT_REAL=$(realpath -- "$raw") || {
    printf '%s\n' "cannot resolve worktree root" >&2
    return 2
  }
  local d
  for d in ticks logs locks mirrors; do
    mkdir -p -- "$FACTORY_WORKTREE_ROOT_REAL/$d" || return 2
    _worktree_refuse_escape "$FACTORY_WORKTREE_ROOT_REAL/$d" "$d" || return 2
    if [ -L "$FACTORY_WORKTREE_ROOT_REAL/$d" ]; then
      printf '%s\n' "symlink-escape: ${d}" >&2
      return 2
    fi
  done
}

worktree_contained() {
  local real
  real=$(realpath -- "$1") || return 1
  case "$real" in
    "$FACTORY_WORKTREE_ROOT_REAL"|"$FACTORY_WORKTREE_ROOT_REAL"/*) return 0 ;;
    *) return 1 ;;
  esac
}

_worktree_refuse_escape() {
  local path="$1" label="$2" real
  if [ -L "$path" ]; then
    real=$(realpath -- "$path") || {
      printf '%s\n' "symlink-escape: ${label}" >&2
      return 2
    }
    case "$real" in
      "$FACTORY_WORKTREE_ROOT_REAL"|"$FACTORY_WORKTREE_ROOT_REAL"/*) ;;
      *)
        printf '%s\n' "symlink-escape: ${label}" >&2
        return 2
        ;;
    esac
  fi
  if [ -e "$path" ] && ! worktree_contained "$path"; then
    printf '%s\n' "symlink-escape: ${label}" >&2
    return 2
  fi
  return 0
}

worktree_alloc_home() {
  local ticks dir
  ticks="$FACTORY_WORKTREE_ROOT_REAL/ticks"
  _worktree_refuse_escape "$ticks" "ticks" || return 2
  dir=$(mktemp -d -- "$ticks/t.XXXXXX") || {
    printf '%s\n' "cannot allocate tick dir" >&2
    return 2
  }
  if [ -L "$dir" ] || ! worktree_contained "$dir"; then
    rm -rf -- "$dir"
    printf '%s\n' "symlink-escape: tick dir" >&2
    return 2
  fi
  printf '%s\n' "$dir"
}

_worktree_repo_key() {
  printf '%s' "$1" | sha256sum | awk '{print $1}'
}

_worktree_canon_url() {
  local u="$1"
  if [ -e "$u" ]; then
    realpath -- "$u"
  else
    printf '%s\n' "$u"
  fi
}

_worktree_mirror_origin() {
  git --git-dir="$1" remote get-url origin 2>/dev/null || true
}

_worktree_ensure_mirror() {
  local url="$1" sha="$2" mirror="$3"
  local tmp want got
  want=$(_worktree_canon_url "$url")
  if [ -e "$mirror" ]; then
    if [ ! -d "$mirror" ] || [ -L "$mirror" ]; then
      printf '%s\n' "mirror is not a directory" >&2
      return 2
    fi
    got=$(_worktree_canon_url "$(_worktree_mirror_origin "$mirror")")
    if [ "$got" != "$want" ]; then
      printf '%s\n' "mirror url mismatch" >&2
      return 2
    fi
  else
    tmp="${mirror}.partial.$$"
    rm -rf -- "$tmp"
    git clone --bare --quiet -- "$url" "$tmp" >/dev/null 2>&1 || {
      rm -rf -- "$tmp"
      return 2
    }
    if ! mv -T -- "$tmp" "$mirror" 2>/dev/null; then
      rm -rf -- "$tmp"
      if [ ! -d "$mirror" ]; then
        printf '%s\n' "cannot publish clone" >&2
        return 2
      fi
      got=$(_worktree_canon_url "$(_worktree_mirror_origin "$mirror")")
      if [ "$got" != "$want" ]; then
        printf '%s\n' "mirror url mismatch" >&2
        return 2
      fi
    fi
  fi
  git --git-dir="$mirror" fetch --quiet -- "$url" "$sha" 2>/dev/null || \
    git --git-dir="$mirror" fetch --quiet -- "$url" 2>/dev/null || true
  git --git-dir="$mirror" rev-parse --verify -q "${sha}^{commit}" >/dev/null || {
    printf '%s\n' "sha not in clone" >&2
    return 2
  }
}

worktree_add_at() {
  local dest="$1" url="$2" sha="$3" branch="$4" full_name="$5"
  local key mirror parent lock rc
  key=$(_worktree_repo_key "$full_name")
  mirror="$FACTORY_WORKTREE_ROOT_REAL/mirrors/${key}.git"
  lock="$FACTORY_WORKTREE_ROOT_REAL/locks/${key}.lock"

  parent=$(dirname -- "$dest")
  _worktree_refuse_escape "$parent" "tick home" || return 2
  case "$dest" in
    "$FACTORY_WORKTREE_ROOT_REAL"/ticks/*/tree) ;;
    *)
      printf '%s\n' "worktree path outside ticks" >&2
      return 2
      ;;
  esac
  if [ -e "$dest" ]; then
    printf '%s\n' "worktree dest exists" >&2
    return 2
  fi

  _worktree_ensure_mirror "$url" "$sha" "$mirror" || return 2

  mkdir -p -- "$FACTORY_WORKTREE_ROOT_REAL/locks"
  rc=0
  {
    flock 9
    git --git-dir="$mirror" worktree add -q -b "$branch" -- "$dest" "$sha" >/dev/null 2>&1 || rc=$?
  } 9>"$lock"
  [ "$rc" -eq 0 ] || return 2

  if [ -L "$dest" ] || ! worktree_contained "$dest"; then
    printf '%s\n' "symlink-escape: worktree" >&2
    return 2
  fi
  printf '%s\n' "$mirror"
}

worktree_remove_at() {
  local dest="$1" mirror="$2" full_name="$3" ours="$4"
  local key dest_real ours_real lock rc
  [ -n "$dest" ] || return 0
  if [ -L "$dest" ]; then
    printf '%s\n' "cleanup refused: dest is a symlink" >&2
    return 2
  fi
  dest_real=$(realpath -- "$dest" 2>/dev/null) || return 0
  if [ -n "$ours" ]; then
    ours_real=$(realpath -- "$ours" 2>/dev/null) || ours_real="$ours"
    if [ "$dest_real" != "$ours_real" ]; then
      printf '%s\n' "cleanup refused: not this tick's tree" >&2
      return 2
    fi
  fi
  worktree_contained "$dest_real" || {
    printf '%s\n' "cleanup refused: path outside worktree root" >&2
    return 2
  }
  case "$dest_real" in
    "$FACTORY_WORKTREE_ROOT_REAL"/ticks/*/tree) ;;
    *)
      printf '%s\n' "cleanup refused: not a tick tree" >&2
      return 2
      ;;
  esac
  [ -n "$mirror" ] || return 0
  key=$(_worktree_repo_key "$full_name")
  lock="$FACTORY_WORKTREE_ROOT_REAL/locks/${key}.lock"
  mkdir -p -- "$FACTORY_WORKTREE_ROOT_REAL/locks"
  rc=0
  {
    flock 9
    if git --git-dir="$mirror" worktree list --porcelain 2>/dev/null \
        | sed -n 's/^worktree //p' | grep -Fqx -- "$dest_real"; then
      git --git-dir="$mirror" worktree remove -- "$dest_real" >/dev/null 2>&1 || rc=$?
    fi
    git --git-dir="$mirror" worktree prune || true
  } 9>"$lock"
  return "$rc"
}

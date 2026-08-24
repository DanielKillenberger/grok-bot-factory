import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { runCmd } from "./cmd.ts";
import { withFileLock } from "./lock.ts";

export type WorktreeRoot = {
  real: string;
};

function contained(real: string, root: string): boolean {
  return real === root || real.startsWith(`${root}/`);
}

function refuseEscape(path: string, label: string, root: string): string | null {
  if (existsSync(path) || pathExists(path)) {
    try {
      if (lstatSync(path).isSymbolicLink()) {
        let real: string;
        try {
          real = realpathSync(path);
        } catch {
          return `symlink-escape: ${label}`;
        }
        if (!contained(real, root)) return `symlink-escape: ${label}`;
      }
    } catch {
      // missing is fine for some paths
    }
  }
  if (existsSync(path)) {
    let real: string;
    try {
      real = realpathSync(path);
    } catch {
      return `symlink-escape: ${label}`;
    }
    if (!contained(real, root)) return `symlink-escape: ${label}`;
  }
  return null;
}

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

export function initWorktreeRoot(raw: string | undefined): WorktreeRoot | { error: string } {
  if (!raw) return { error: "missing worktree root" };
  try {
    mkdirSync(raw, { recursive: true });
  } catch {
    return { error: "cannot create worktree root" };
  }
  let real: string;
  try {
    real = realpathSync(raw);
  } catch {
    return { error: "cannot resolve worktree root" };
  }
  for (const d of ["ticks", "logs", "locks", "mirrors"]) {
    const p = join(real, d);
    try {
      mkdirSync(p, { recursive: true });
    } catch {
      return { error: `cannot create worktree root` };
    }
    const escaped = refuseEscape(p, d, real);
    if (escaped) return { error: escaped };
    try {
      if (lstatSync(p).isSymbolicLink()) return { error: `symlink-escape: ${d}` };
    } catch {
      return { error: `symlink-escape: ${d}` };
    }
  }
  return { real };
}

export function allocHome(root: string): string | { error: string } {
  const ticks = join(root, "ticks");
  const escaped = refuseEscape(ticks, "ticks", root);
  if (escaped) return { error: escaped };
  let dir: string;
  try {
    dir = mkdtempSync(join(ticks, "t."));
  } catch {
    return { error: "cannot allocate tick dir" };
  }
  try {
    if (lstatSync(dir).isSymbolicLink() || !contained(realpathSync(dir), root)) {
      rmSync(dir, { recursive: true, force: true });
      return { error: "symlink-escape: tick dir" };
    }
  } catch {
    rmSync(dir, { recursive: true, force: true });
    return { error: "symlink-escape: tick dir" };
  }
  return dir;
}

export function repoKey(fullName: string): string {
  return createHash("sha256").update(fullName).digest("hex");
}

function canonUrl(url: string): string {
  if (existsSync(url)) {
    try {
      return realpathSync(url);
    } catch {
      return url;
    }
  }
  return url;
}

async function mirrorOrigin(mirror: string): Promise<string> {
  const res = await runCmd(["git", `--git-dir=${mirror}`, "remote", "get-url", "origin"]);
  return res.code === 0 ? res.stdout.trim() : "";
}

async function ensureMirror(
  url: string,
  sha: string,
  mirror: string,
): Promise<{ error?: string }> {
  const want = canonUrl(url);
  if (pathExists(mirror)) {
    try {
      const st = lstatSync(mirror);
      if (!st.isDirectory() || st.isSymbolicLink()) {
        return { error: "mirror is not a directory" };
      }
    } catch {
      return { error: "mirror is not a directory" };
    }
    const got = canonUrl(await mirrorOrigin(mirror));
    if (got !== want) return { error: "mirror url mismatch" };
  } else {
    const tmp = `${mirror}.partial.${process.pid}`;
    rmSync(tmp, { recursive: true, force: true });
    const cloned = await runCmd(["git", "clone", "--bare", "--quiet", "--", url, tmp]);
    if (cloned.code !== 0 || cloned.timedOut) {
      rmSync(tmp, { recursive: true, force: true });
      return { error: "cannot create worktree" };
    }
    try {
      renameSync(tmp, mirror);
    } catch {
      rmSync(tmp, { recursive: true, force: true });
      if (!existsSync(mirror)) return { error: "cannot publish clone" };
      const got = canonUrl(await mirrorOrigin(mirror));
      if (got !== want) return { error: "mirror url mismatch" };
    }
  }
  const fetchSha = await runCmd(["git", `--git-dir=${mirror}`, "fetch", "--quiet", "--", url, sha]);
  if (fetchSha.code !== 0 || fetchSha.timedOut) {
    const fetchAll = await runCmd(["git", `--git-dir=${mirror}`, "fetch", "--quiet", "--", url]);
    if (fetchAll.timedOut) return { error: "cannot create worktree" };
  }
  const verify = await runCmd([
    "git",
    `--git-dir=${mirror}`,
    "rev-parse",
    "--verify",
    "-q",
    `${sha}^{commit}`,
  ]);
  if (verify.code !== 0 || verify.timedOut) return { error: "sha not in clone" };
  return {};
}

function destPatternOk(dest: string, root: string): boolean {
  const prefix = `${root}/ticks/`;
  if (!dest.startsWith(prefix)) return false;
  const rest = dest.slice(prefix.length);
  const parts = rest.split("/");
  return parts.length === 2 && parts[1] === "tree" && parts[0].length > 0;
}

export async function worktreeAddAt(opts: {
  dest: string;
  url: string;
  sha: string;
  branch: string;
  fullName: string;
  root: string;
}): Promise<{ mirror: string } | { error: string }> {
  const { dest, url, sha, branch, fullName, root } = opts;
  const key = repoKey(fullName);
  const mirror = join(root, "mirrors", `${key}.git`);
  const lock = join(root, "locks", `${key}.lock`);
  const parent = dirname(dest);
  const escaped = refuseEscape(parent, "tick home", root);
  if (escaped) return { error: escaped };
  if (!destPatternOk(dest, root)) return { error: "worktree path outside ticks" };
  if (pathExists(dest)) return { error: "worktree dest exists" };

  try {
    return await withFileLock(lock, async () => {
      const ensured = await ensureMirror(url, sha, mirror);
      if (ensured.error) throw new Error(ensured.error);
      const added = await runCmd([
        "git",
        `--git-dir=${mirror}`,
        "worktree",
        "add",
        "-q",
        "-b",
        branch,
        "--",
        dest,
        sha,
      ]);
      if (added.code !== 0 || added.timedOut) {
        throw new Error("cannot create worktree");
      }
      return { mirror };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cannot create worktree";
    return { error: msg };
  }
}

async function listedWorktrees(mirror: string): Promise<string[]> {
  const res = await runCmd(["git", `--git-dir=${mirror}`, "worktree", "list", "--porcelain"]);
  if (res.code !== 0) return [];
  const out: string[] = [];
  for (const line of res.stdout.split("\n")) {
    if (line.startsWith("worktree ")) out.push(line.slice("worktree ".length));
  }
  return out;
}

export async function worktreeRemoveAt(opts: {
  dest: string;
  mirror: string;
  fullName: string;
  ours: string;
  root: string;
  branch?: string;
}): Promise<{ error?: string }> {
  const { dest, mirror, fullName, ours, root, branch } = opts;
  if (!dest) return {};
  try {
    if (lstatSync(dest).isSymbolicLink()) {
      return { error: "cleanup refused: dest is a symlink" };
    }
  } catch {
    return {};
  }
  let destReal: string;
  try {
    destReal = realpathSync(dest);
  } catch {
    return {};
  }
  if (ours) {
    let oursReal = ours;
    try {
      oursReal = realpathSync(ours);
    } catch {
      oursReal = ours;
    }
    if (destReal !== oursReal) {
      return { error: "cleanup refused: not this tick's tree" };
    }
  }
  if (!contained(destReal, root)) {
    return { error: "cleanup refused: path outside worktree root" };
  }
  if (!destPatternOk(destReal, root)) {
    return { error: "cleanup refused: not a tick tree" };
  }
  if (!mirror) return {};
  const key = repoKey(fullName);
  const lock = join(root, "locks", `${key}.lock`);
  try {
    await withFileLock(lock, async () => {
      const listed = await listedWorktrees(mirror);
      if (listed.includes(destReal)) {
        const rm = await runCmd([
          "git",
          `--git-dir=${mirror}`,
          "worktree",
          "remove",
          "--",
          destReal,
        ]);
        if (rm.code !== 0 || rm.timedOut) {
          throw new Error("dirty or locked tree; not force-removed");
        }
      }
      if (branch) {
        await runCmd(["git", `--git-dir=${mirror}`, "branch", "-D", "--", branch]);
      }
      await runCmd(["git", `--git-dir=${mirror}`, "worktree", "prune"]);
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cannot remove worktree";
    return { error: msg };
  }
  return {};
}

export function tickIdFromHome(home: string): string {
  return basename(home);
}

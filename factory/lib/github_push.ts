export const REPO_FULL_NAME_RE = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const ZERO_SHA = "0000000000000000000000000000000000000000";

export function isRepoFullName(s: string): boolean {
  if (!REPO_FULL_NAME_RE.test(s)) return false;
  const [owner, repo] = s.split("/");
  return owner !== "." && owner !== ".." && repo !== "." && repo !== "..";
}

export type PushIdentity = {
  full_name: string;
  after: string;
  ref: string;
  deleted: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function okRef(v: unknown): v is string {
  return typeof v === "string" && v !== "" && !v.includes("\n") && !v.includes("\r");
}

export type ParseResult =
  | { kind: "ok"; ident: PushIdentity }
  | { kind: "quiet" }
  | { kind: "stuck"; reason: string };

export function parsePushBody(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { kind: "quiet" };
  }
  if (!isRecord(data)) return { kind: "quiet" };
  if (typeof data.zen === "string" && !("after" in data)) return { kind: "quiet" };
  if (!isRecord(data.repository)) return { kind: "quiet" };
  const full_name = data.repository.full_name;
  if (typeof full_name !== "string" || !isRepoFullName(full_name)) return { kind: "quiet" };
  const after = data.after;
  if (typeof after !== "string" || !SHA_RE.test(after)) return { kind: "quiet" };
  if (!okRef(data.ref)) return { kind: "quiet" };
  if ("deleted" in data && typeof data.deleted !== "boolean") return { kind: "quiet" };
  const deleted = typeof data.deleted === "boolean" ? data.deleted : false;
  if (deleted || after === ZERO_SHA) return { kind: "quiet" };
  return {
    kind: "ok",
    ident: { full_name, after, ref: data.ref, deleted },
  };
}

export async function readPayload(src: string | undefined): Promise<ParseResult> {
  if (src && src !== "-") {
    const file = Bun.file(src);
    if (!(await file.exists())) {
      return { kind: "stuck", reason: "cannot read payload file" };
    }
    try {
      const raw = await file.text();
      return parsePushBody(raw);
    } catch {
      return { kind: "stuck", reason: "cannot read payload file" };
    }
  }
  try {
    const raw = await Bun.stdin.text();
    return parsePushBody(raw);
  } catch {
    return { kind: "stuck", reason: "cannot parse payload" };
  }
}

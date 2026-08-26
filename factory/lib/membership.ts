import { gh } from "./gh.ts";

const ENTRY_TYPES = new Set(["file", "dir", "symlink", "submodule"]);

function membersList(): string[] {
  const raw = process.env.FACTORY_MEMBERSHIP_WHITELIST ?? "";
  return raw.split(/[,\s]+/).filter((s) => s.length > 0);
}

function isContentsListing(body: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return false;
  }
  if (!Array.isArray(data)) return false;
  return data.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const rec = item as Record<string, unknown>;
    return (
      typeof rec.name === "string" &&
      typeof rec.type === "string" &&
      ENTRY_TYPES.has(rec.type)
    );
  });
}

export type MemberResult = "member" | "quiet" | "stuck";

/** Exactly one `owner/name` pair; extra slashes or blanks fail closed. */
export function isRepoFullName(s: string): boolean {
  const parts = s.split("/");
  if (parts.length !== 2) return false;
  const [owner, repo] = parts;
  return owner.length > 0 && repo.length > 0 && !/\s/.test(s);
}

export async function probeFlowDir(
  fullName: string,
  ref?: string,
): Promise<{ result: MemberResult; reason?: string }> {
  if (!isRepoFullName(fullName)) {
    return {
      result: "stuck",
      reason: `membership: invalid repo name ${fullName}`,
    };
  }
  const [owner, repo] = fullName.split("/");
  const argv = [
    "api",
    "--method",
    "GET",
    `repos/${owner}/${repo}/contents/.flow`,
  ];
  if (ref) {
    argv.push("-f", `ref=${ref}`);
  }
  const res = await gh(argv);
  const at = ref ? ` at ${ref}` : "";
  if (res.ok) {
    if (!isContentsListing(res.stdout)) {
      return {
        result: "stuck",
        reason: `membership: malformed contents for ${fullName} .flow${at}`,
      };
    }
    return { result: "member" };
  }
  if (res.class === "404") return { result: "quiet" };
  if (res.class === "403") {
    return {
      result: "stuck",
      reason: `membership: contents 403 for ${fullName} .flow${at}`,
    };
  }
  return {
    result: "stuck",
    reason: `membership: gh ${res.class} reading ${fullName} .flow${at}`,
  };
}

export async function membershipCheck(
  fullName: string,
  after: string,
): Promise<{ result: MemberResult; reason?: string }> {
  const members = membersList();
  if (members.length > 0) {
    return { result: members.includes(fullName) ? "member" : "quiet" };
  }
  return probeFlowDir(fullName, after);
}

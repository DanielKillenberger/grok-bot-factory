import { gh } from "./gh.ts";

const ENTRY_TYPES = new Set(["file", "dir", "symlink", "submodule"]);
const JSON_NAME_RE = /^[A-Za-z0-9._-]+\.json$/;
const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done"]);

type JsonObject = Record<string, unknown>;

function parseJson(text: string): unknown {
  return JSON.parse(text);
}

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isContentsListing(data: unknown): data is JsonObject[] {
  if (!Array.isArray(data)) return false;
  return data.every((item) => {
    if (!isObject(item)) return false;
    return (
      typeof item.name === "string" &&
      typeof item.type === "string" &&
      ENTRY_TYPES.has(item.type)
    );
  });
}

function readyBool(obj: JsonObject): "true" | "false" | "bad" {
  if (!("ready" in obj)) return "false";
  if (typeof obj.ready === "boolean") return obj.ready ? "true" : "false";
  return "bad";
}

async function listJsonDir(
  owner: string,
  repo: string,
  path: string,
  after: string,
): Promise<{ names?: string[]; stuck?: string }> {
  const res = await gh([
    "api",
    "--method",
    "GET",
    `repos/${owner}/${repo}/contents/${path}`,
    "-f",
    `ref=${after}`,
  ]);
  if (!res.ok) {
    if (res.class === "404") return { names: [] };
    return { stuck: `ready: gh ${res.class} listing ${path}` };
  }
  let data: unknown;
  try {
    data = parseJson(res.stdout);
  } catch {
    return { stuck: `ready: partial or non-directory listing for ${path}` };
  }
  if (!Array.isArray(data)) {
    return { stuck: `ready: partial or non-directory listing for ${path}` };
  }
  if (!isContentsListing(data)) {
    return { stuck: `ready: malformed directory listing for ${path}` };
  }
  if (data.length >= 1000) {
    return { stuck: `ready: incomplete directory listing for ${path}` };
  }
  const names = data
    .filter((e) => e.type === "file" && JSON_NAME_RE.test(e.name as string))
    .map((e) => e.name as string);
  return { names };
}

function decodeGithubContent(b64: string): string {
  const compact = b64.replace(/[\n\r ]/g, "");
  return Buffer.from(compact, "base64").toString("utf8");
}

async function getJsonFile(
  owner: string,
  repo: string,
  path: string,
  after: string,
): Promise<{ body?: JsonObject; stuck?: string }> {
  const res = await gh([
    "api",
    "--method",
    "GET",
    `repos/${owner}/${repo}/contents/${path}`,
    "-f",
    `ref=${after}`,
  ]);
  if (!res.ok) {
    return { stuck: `ready: gh ${res.class} reading ${path}` };
  }
  let data: unknown;
  try {
    data = parseJson(res.stdout);
  } catch {
    return { stuck: `ready: malformed contents object for ${path}` };
  }
  if (!isObject(data) || data.encoding !== "base64" || typeof data.content !== "string") {
    return { stuck: `ready: malformed contents object for ${path}` };
  }
  let decoded: string;
  try {
    decoded = decodeGithubContent(data.content);
  } catch {
    return { stuck: `ready: base64 decode failed for ${path}` };
  }
  let body: unknown;
  try {
    body = parseJson(decoded);
  } catch {
    return { stuck: `ready: malformed sidecar JSON ${path}` };
  }
  if (!isObject(body)) {
    return { stuck: `ready: malformed sidecar JSON ${path}` };
  }
  return { body };
}

async function openPr(
  owner: string,
  repo: string,
  branch: string,
): Promise<{ open?: boolean; stuck?: string }> {
  const res = await gh([
    "api",
    "--method",
    "GET",
    `repos/${owner}/${repo}/pulls`,
    "-f",
    "state=open",
    "-f",
    `head=${owner}:${branch}`,
    "-f",
    "per_page=5",
  ]);
  if (!res.ok) {
    return { stuck: `ready: gh ${res.class} listing PRs for ${owner}/${repo} head ${branch}` };
  }
  let data: unknown;
  try {
    data = parseJson(res.stdout);
  } catch {
    return { stuck: "ready: malformed PR list" };
  }
  if (!Array.isArray(data)) return { stuck: "ready: malformed PR list" };
  return { open: data.length > 0 };
}

async function classifySpec(
  spec: JsonObject,
  tasks: JsonObject[],
  fullName: string,
): Promise<{ kind?: "land" | "pilot" | "unclassifiable"; stuck?: string }> {
  if (typeof spec.id !== "string" || spec.id === "") {
    return { kind: "unclassifiable" };
  }
  const specId = spec.id;
  const related = tasks.filter((t) => typeof t.spec === "string" && t.spec === specId);
  let statuses: "none" | "bad" | "all_done" | "open";
  if (related.length === 0) statuses = "none";
  else if (
    !related.every(
      (t) => typeof t.status === "string" && TASK_STATUSES.has(t.status),
    )
  ) {
    statuses = "bad";
  } else if (related.every((t) => t.status === "done")) statuses = "all_done";
  else statuses = "open";

  if (statuses === "none" || statuses === "open") return { kind: "pilot" };
  if (statuses === "all_done") {
    if (typeof spec.branch_name !== "string" || spec.branch_name === "") {
      return { kind: "unclassifiable" };
    }
    const [owner, repo] = fullName.split("/");
    const pr = await openPr(owner, repo, spec.branch_name);
    if (pr.stuck) return { stuck: pr.stuck };
    return { kind: pr.open ? "land" : "pilot" };
  }
  return { kind: "unclassifiable" };
}

export async function readySelect(
  fullName: string,
  after: string,
): Promise<{ kind?: "pilot" | "land"; quiet?: true; stuck?: string }> {
  const [owner, repo] = fullName.split("/");
  const specList = await listJsonDir(owner, repo, ".flow/specs", after);
  if (specList.stuck) return { stuck: specList.stuck };
  const taskList = await listJsonDir(owner, repo, ".flow/tasks", after);
  if (taskList.stuck) return { stuck: taskList.stuck };

  const specs: JsonObject[] = [];
  for (const name of specList.names ?? []) {
    const got = await getJsonFile(owner, repo, `.flow/specs/${name}`, after);
    if (got.stuck) return { stuck: got.stuck };
    const body = got.body!;
    if (readyBool(body) === "bad") {
      return { stuck: `ready: malformed ready field in .flow/specs/${name}` };
    }
    specs.push(body);
  }
  const tasks: JsonObject[] = [];
  for (const name of taskList.names ?? []) {
    const got = await getJsonFile(owner, repo, `.flow/tasks/${name}`, after);
    if (got.stuck) return { stuck: got.stuck };
    const body = got.body!;
    if (readyBool(body) === "bad") {
      return { stuck: `ready: malformed ready field in .flow/tasks/${name}` };
    }
    tasks.push(body);
  }

  let kindLand = false;
  let kindPilot = false;
  let kindBad = false;

  for (const spec of specs) {
    if (readyBool(spec) !== "true") continue;
    const classified = await classifySpec(spec, tasks, fullName);
    if (classified.stuck) return { stuck: classified.stuck };
    if (classified.kind === "land") kindLand = true;
    else if (classified.kind === "pilot") kindPilot = true;
    else kindBad = true;
  }

  for (const task of tasks) {
    if (readyBool(task) !== "true") continue;
    const ok =
      typeof task.id === "string" &&
      typeof task.spec === "string" &&
      typeof task.status === "string" &&
      TASK_STATUSES.has(task.status);
    if (!ok) {
      kindBad = true;
      continue;
    }
    kindPilot = true;
  }

  if (kindBad) return { stuck: "ready: unclassifiable ready item" };
  if (kindLand) return { kind: "land" };
  if (kindPilot) return { kind: "pilot" };
  return { quiet: true };
}

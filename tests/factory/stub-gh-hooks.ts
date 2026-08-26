#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const log = process.env.FACTORY_GH_LOG;
if (!log) {
  console.error("FACTORY_GH_LOG missing");
  process.exit(1);
}

const args = process.argv.slice(2).join(" ");
appendFileSync(log, `${args}\n`);

if (/\bclone\b/.test(args)) {
  console.error("gh: clone is forbidden on the hook path");
  process.exit(1);
}

function httpErr(code: number, msg: string): never {
  console.error(`gh: ${msg} (HTTP ${code})`);
  process.exit(1);
}

function networkErr(): never {
  console.error(
    'gh: Get "https://api.github.com/": dial tcp: lookup api.github.com: no such host',
  );
  process.exit(1);
}

const scenario = process.env.FACTORY_STUB;
if (!scenario) {
  console.error("FACTORY_STUB missing");
  process.exit(1);
}

const routineUrl = process.env.FACTORY_ROUTINE_URL ?? "";

type StoredHook = {
  id: number;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    secret: string;
    insecure_ssl: string;
  };
};

type State = {
  nextId: number;
  repos: Record<string, StoredHook[]>;
  post422: Record<string, boolean>;
};

const stateFile = `${log}.state`;

function loadState(): State {
  if (existsSync(stateFile)) {
    return JSON.parse(readFileSync(stateFile, "utf8")) as State;
  }
  return { nextId: 1, repos: {}, post422: {} };
}

function saveState(state: State): void {
  writeFileSync(stateFile, `${JSON.stringify(state)}\n`);
}

function hookView(h: StoredHook): StoredHook {
  return {
    ...h,
    config: { ...h.config, secret: "********" },
  };
}

function makeHook(
  state: State,
  url: string,
  extra: Partial<StoredHook> = {},
): StoredHook {
  const id = extra.id ?? state.nextId++;
  return {
    id,
    name: extra.name ?? "web",
    active: extra.active ?? true,
    events: extra.events ?? ["push"],
    config: {
      url,
      content_type: extra.config?.content_type ?? "json",
      secret: extra.config?.secret ?? "********",
      insecure_ssl: extra.config?.insecure_ssl ?? "0",
    },
  };
}

function otherUrl(i: number): string {
  return `${"https://"}example.invalid/${"other"}/${String(i).padStart(2, "0")}`;
}

function seedMany(state: State, repo: string): StoredHook[] {
  const hooks: StoredHook[] = [];
  for (let i = 0; i < 35; i++) {
    const url = i === 34 ? routineUrl : otherUrl(i + 1);
    hooks.push(makeHook(state, url, { active: i === 34 ? false : true }));
  }
  state.repos[repo] = hooks;
  return hooks;
}

function seedRepo(state: State, repo: string): StoredHook[] {
  if (state.repos[repo]) return state.repos[repo];
  if (scenario === "many") return seedMany(state, repo);
  if (scenario === "one" || scenario === "one_match") {
    state.repos[repo] = [
      makeHook(state, routineUrl, {
        active: false,
        events: ["push", "pull_request"],
      }),
    ];
    return state.repos[repo];
  }
  if (scenario === "dup" || scenario === "dup_match") {
    state.repos[repo] = [makeHook(state, routineUrl), makeHook(state, routineUrl)];
    return state.repos[repo];
  }
  if (scenario === "other") {
    state.repos[repo] = [makeHook(state, otherUrl(1))];
    return state.repos[repo];
  }
  state.repos[repo] = [];
  return state.repos[repo];
}

function methodOf(): string {
  const m = args.match(/--method\s+(\w+)/i);
  return (m ? m[1] : "GET").toUpperCase();
}

function parseTarget(): {
  repo: string;
  id: number | null;
  page: number;
  perPage: number;
} | null {
  const m = args.match(/repos\/([^/]+\/[^/?]+)\/hooks(?:\/(\d+))?(\?[^\s]*)?/);
  if (!m) return null;
  const query = m[3] ?? "";
  const pageM = query.match(/[?&]page=(\d+)/);
  const perM = query.match(/[?&]per_page=(\d+)/);
  return {
    repo: m[1],
    id: m[2] ? Number(m[2]) : null,
    page: pageM ? Number(pageM[1]) : 1,
    perPage: perM ? Number(perM[1]) : 30,
  };
}

function logMutate(rec: Record<string, unknown>): void {
  appendFileSync(`${log}.hooks`, `${JSON.stringify(rec)}\n`);
}

if (scenario === "network") networkErr();

const method = methodOf();
const target = parseTarget();
if (!target) httpErr(404, "Not Found");

if (method === "GET" && target.id === null) {
  if (
    scenario === "get_401" ||
    scenario === "list_401"
  ) {
    httpErr(401, "Bad credentials");
  }
  if (scenario === "get_403" || scenario === "list_403") {
    httpErr(403, "Resource not accessible by integration");
  }
  if (scenario === "get_429" || scenario === "list_429") {
    httpErr(429, "API rate limit exceeded");
  }
  if (scenario === "get_500" || scenario === "list_500") {
    httpErr(502, "Server Error");
  }
  if (scenario === "partial" && target.repo === "acme/fail") {
    httpErr(500, "Server Error");
  }
  if (scenario === "malformed") {
    process.stdout.write("{not-json\n");
    process.exit(0);
  }
  const state = loadState();
  const hooks = seedRepo(state, target.repo);
  saveState(state);
  const views = hooks.map(hookView);
  if (args.includes("--paginate")) {
    const pages: StoredHook[][] = [];
    for (let i = 0; i < views.length; i += target.perPage) {
      pages.push(views.slice(i, i + target.perPage));
    }
    if (pages.length === 0) pages.push([]);
    if (args.includes("--slurp")) {
      process.stdout.write(`${JSON.stringify(pages)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(pages.flat())}\n`);
    }
    process.exit(0);
  }
  const start = (target.page - 1) * target.perPage;
  const slice = views.slice(start, start + target.perPage);
  process.stdout.write(`${JSON.stringify(slice)}\n`);
  process.exit(0);
}

let raw = "";
if (args.includes("--input")) {
  raw = await Bun.stdin.text();
  appendFileSync(`${log}.body`, raw.endsWith("\n") ? raw : `${raw}\n`);
}
let body: unknown = {};
if (raw) {
  try {
    body = JSON.parse(raw);
  } catch {
    httpErr(400, "malformed input");
  }
}

if (method === "POST" && target.id === null) {
  logMutate({ method: "POST", repo: target.repo, body });
  if (scenario === "post_fail") httpErr(500, "Server Error");
  const state = loadState();
  seedRepo(state, target.repo);
  if (scenario === "post_422" && !state.post422[target.repo]) {
    state.post422[target.repo] = true;
    state.repos[target.repo] = [makeHook(state, routineUrl)];
    saveState(state);
    httpErr(422, "Validation Failed");
  }
  const rec = body as {
    name?: unknown;
    active?: unknown;
    events?: unknown;
    config?: {
      url?: unknown;
      content_type?: unknown;
      secret?: unknown;
      insecure_ssl?: unknown;
    };
  };
  const url = typeof rec.config?.url === "string" ? rec.config.url : "";
  const hook = makeHook(state, url, {
    name: typeof rec.name === "string" ? rec.name : "web",
    active: rec.active === true,
    events: Array.isArray(rec.events) ? (rec.events as string[]) : ["push"],
    config: {
      url,
      content_type:
        typeof rec.config?.content_type === "string" ? rec.config.content_type : "json",
      secret: typeof rec.config?.secret === "string" ? rec.config.secret : "",
      insecure_ssl:
        typeof rec.config?.insecure_ssl === "string" ? rec.config.insecure_ssl : "0",
    },
  });
  state.repos[target.repo] = [...(state.repos[target.repo] ?? []), hook];
  saveState(state);
  process.stdout.write(`${JSON.stringify(hookView(hook))}\n`);
  process.exit(0);
}

if (method === "PATCH" && target.id !== null) {
  logMutate({ method: "PATCH", repo: target.repo, id: target.id, body });
  const state = loadState();
  const hooks = seedRepo(state, target.repo);
  const idx = hooks.findIndex((h) => h.id === target.id);
  if (idx < 0) {
    saveState(state);
    httpErr(404, "Not Found");
  }
  const rec = body as {
    active?: unknown;
    events?: unknown;
    config?: {
      url?: unknown;
      content_type?: unknown;
      secret?: unknown;
      insecure_ssl?: unknown;
    };
  };
  const prev = hooks[idx];
  const url = typeof rec.config?.url === "string" ? rec.config.url : prev.config.url;
  const updated: StoredHook = {
    ...prev,
    active: rec.active === true,
    events: Array.isArray(rec.events) ? (rec.events as string[]) : prev.events,
    config: {
      url,
      content_type:
        typeof rec.config?.content_type === "string"
          ? rec.config.content_type
          : prev.config.content_type,
      secret: typeof rec.config?.secret === "string" ? rec.config.secret : prev.config.secret,
      insecure_ssl:
        typeof rec.config?.insecure_ssl === "string"
          ? rec.config.insecure_ssl
          : prev.config.insecure_ssl,
    },
  };
  hooks[idx] = updated;
  state.repos[target.repo] = hooks;
  saveState(state);
  process.stdout.write(`${JSON.stringify(hookView(updated))}\n`);
  process.exit(0);
}

if (method === "DELETE") {
  logMutate({ method: "DELETE", repo: target.repo, id: target.id });
  httpErr(404, "Not Found");
}

httpErr(404, "Not Found");

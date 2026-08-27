import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISCOVER,
  FIX,
  ROOT,
  STUB_GH_DISCOVER,
  SKILL_EASY_INSTALL,
  linkStub,
  makeBin,
  runBun,
  tempDir,
} from "./helpers.ts";

let tmp = "";
let path = "";
let ghLog = "";

function env(stub: string, extra: Record<string, string | undefined> = {}) {
  return {
    PATH: path,
    FACTORY_FIXTURES: FIX,
    FACTORY_GH_LOG: ghLog,
    FACTORY_STUB: stub,
    FACTORY_MEMBERSHIP_WHITELIST: undefined,
    ...extra,
  };
}

function freshLog() {
  writeFileSync(ghLog, "");
  rmSync(`${ghLog}.hooks`, { force: true });
  rmSync(`${ghLog}.secrets`, { force: true });
  rmSync(`${ghLog}.mutate`, { force: true });
  rmSync(`${ghLog}.429`, { force: true });
}

beforeEach(() => {
  tmp = tempDir();
  const made = makeBin(tmp);
  path = made.path;
  linkStub(made.bin, "gh", STUB_GH_DISCOVER);
  ghLog = join(tmp, "gh.log");
  freshLog();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function ghLogText(): string {
  return existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
}

function noMutate(label: string) {
  for (const kind of ["hooks", "secrets", "mutate"] as const) {
    if (existsSync(`${ghLog}.${kind}`)) {
      throw new Error(`${label} (${kind}: ${readFileSync(`${ghLog}.${kind}`, "utf8")})`);
    }
  }
  expect(ghLogText(), label).not.toMatch(/\bhooks\b|\/hooks/);
  expect(ghLogText(), label).not.toMatch(/\bsecret set\b|\/actions\/secrets/);
  expect(ghLogText(), label).not.toMatch(/\bclone\b/);
}

async function runDiscover(
  argv: string[] = [],
  stub = "ok",
  extra: Record<string, string | undefined> = {},
) {
  return runBun(DISCOVER, argv, { env: env(stub, extra) });
}

test("lists .flow candidates via gh without clone and skips repos without .flow", async () => {
  const res = await runDiscover();
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as {
    candidates: string[];
    named_without_flow: string[];
  };
  expect(body.candidates).toEqual(["acme/app", "acme/lib"]);
  expect(body.named_without_flow).toEqual([]);
  expect(ghLogText()).toMatch(/repo list/);
  expect(ghLogText()).toMatch(/--limit\s+100\b|--limit=100\b/);
  noMutate("happy path");
});

test("pagination cap fails closed instead of a silent partial list", async () => {
  const res = await runDiscover([], "list_full", { FACTORY_DISCOVER_PAGE_CAP: "100" });
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/incomplete/);
  noMutate("cap");
});

test("paginates past the 30-repo default", async () => {
  const res = await runDiscover([], "many");
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as { candidates: string[] };
  expect(body.candidates).toHaveLength(35);
  const limits = [...ghLogText().matchAll(/--limit(?:\s+|=)(\d+)/g)].map((m) => Number(m[1]));
  expect(limits.some((n) => n > 30)).toBe(true);
  noMutate("many");
});

test("named repo without .flow is reported, not skipped or inited", async () => {
  const res = await runDiscover(["--named", "acme/named"]);
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as {
    candidates: string[];
    named_without_flow: string[];
  };
  expect(body.candidates).toEqual(["acme/app", "acme/lib"]);
  expect(body.named_without_flow).toEqual(["acme/named"]);
  expect(ghLogText()).not.toMatch(/flow-next:setup|git init/);
  noMutate("named");
});

test("malformed owner/name fails closed", async () => {
  for (const name of ["acme/app/typo", "acme/", "/app", "noslash", "acme/app?", "acme/..", "acme/."]) {
    const res = await runDiscover(["--named", name]);
    expect(res.code, name).toBe(20);
    expect(res.stdout.trim(), name).toBe("");
    expect(res.stderr, name).toMatch(/invalid repo name/);
    noMutate(name);
  }
});

test("whitelist overlay does not fleet-scan", async () => {
  const res = await runDiscover(["--whitelist", "acme/app"]);
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as { candidates: string[] };
  expect(body.candidates).toEqual(["acme/app"]);
  expect(ghLogText()).not.toMatch(/repo list/);
  noMutate("whitelist");
});

const failClosed: [string, string][] = [
  ["list 401", "list_401"],
  ["list 403", "list_403"],
  ["list 429", "list_429"],
  ["list 5xx", "list_500"],
  ["network", "network"],
  ["malformed list", "list_malformed"],
  ["probe 401", "probe_401"],
  ["probe 403", "probe_403"],
  ["probe 429", "probe_429"],
  ["probe 5xx", "probe_500"],
  ["malformed contents", "malformed"],
  ["mid-scan", "mid_scan"],
];

for (const [label, stub] of failClosed) {
  test(`${label} fails closed with no confirmable list`, async () => {
    const res = await runDiscover([], stub);
    expect(res.code, label).toBe(20);
    expect(res.stdout.trim(), label).toBe("");
    expect(res.stderr, label).toMatch(/discover:|membership:/);
    noMutate(label);
  });
}

const WALKTHROUGH_BEATS = [
  "Orient",
  "Find repos",
  "You pick",
  "Builder/webhook",
  "Paste two secrets",
  "Done",
] as const;

const BEAT_ACTION_AFTER_WHY: Record<(typeof WALKTHROUGH_BEATS)[number], RegExp> = {
  Orient: /Wait for them to confirm they understand/,
  "Find repos": /bun factory\/discover\.ts/,
  "You pick": /Wait for an explicit confirmation reply/,
  "Builder/webhook": /Assign an existing builder/,
  "Paste two secrets": /bun factory\/install\.ts --confirmed/,
  Done: /Stop\. Do not recap/,
};

function beatHeading(n: number, title: string): RegExp {
  return new RegExp(`^## ${n}\\.\\s+${title.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*$`, "m");
}

function beatBody(skill: string, n: number, title: string): string {
  const start = skill.search(beatHeading(n, title));
  if (start < 0) return "";
  const rest = skill.slice(start);
  const next = rest.search(/\n## /);
  return next < 0 ? rest : rest.slice(0, next);
}

test("skill waits for confirm and does not invoke install before it", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/Wait for an explicit confirmation reply/);
  expect(skill).toMatch(/only after that confirmation reply|only after confirm/i);
  expect(skill).toMatch(/bun factory\/install\.ts --confirmed/);
  expect(skill).toMatch(/Do not auto-init/);
  expect(skill).toMatch(/conversation, not a clicks-only UI/);
  expect(skill).not.toMatch(/hooks\.github\.com/);
  expect(skill).not.toMatch(/factory\/hooks\.ts/);
});

test("skill is a six-beat walkthrough that orients before discover", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  const fm = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  expect(fm).not.toMatch(/description:\s*.*Discover/i);
  expect(fm).toMatch(/description:\s*.*Orient/i);

  let last = -1;
  for (const [i, title] of WALKTHROUGH_BEATS.entries()) {
    const idx = skill.search(beatHeading(i + 1, title));
    expect(idx, title).toBeGreaterThan(last);
    last = idx;
    const body = beatBody(skill, i + 1, title).replace(/^## .*$/m, "").trim();
    const parts = body.split(/\n\s*\n/);
    const firstPara = (parts[0] ?? "").replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
    const afterWhy = parts.slice(1).join("\n\n");
    expect(firstPara, `${title} why`).toMatch(/[A-Za-z].{15,}/);
    expect(firstPara, `${title} not a command-only beat`).not.toMatch(/^```/);
    expect(afterWhy, `${title} action after why`).toMatch(BEAT_ACTION_AFTER_WHY[title]);
  }

  const orient = skill.search(beatHeading(1, "Orient"));
  const pause = skill.search(/Do not run discover yet/);
  const firstDiscoverFence = skill.search(/```(?:bash)?\n[^\n]*bun factory\/discover\.ts/);
  expect(orient).toBeGreaterThan(-1);
  expect(pause).toBeGreaterThan(orient);
  expect(firstDiscoverFence).toBeGreaterThan(pause);

  const youPick = skill.search(beatHeading(3, "You pick"));
  const paste = skill.search(beatHeading(5, "Paste two secrets"));
  const installFence = skill.search(/```(?:bash)?\n[^\n]*bun factory\/install\.ts --confirmed/);
  expect(installFence).toBeGreaterThan(paste);
  expect(paste).toBeGreaterThan(youPick);
});

test("skill no-confirm path uses targeted named+whitelist discover, not fleet", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/do not confirm/i);
  expect(skill).toMatch(/where they want to apply this factory/);
  expect(skill).toMatch(/\/flow-next:setup/);
  expect(skill).toMatch(
    /bun factory\/discover\.ts --named owner\/name --whitelist owner\/name/,
  );
  expect(skill).toMatch(/did not return in `candidates`/);
  expect(skill).toMatch(/named_without_flow[\s\S]{0,400}Do not install/);

  const fleetFence = /```(?:bash)?\n\s*bun factory\/discover\.ts\s*\n```/;
  const findRepos = skill.search(beatHeading(2, "Find repos"));
  expect(skill.search(fleetFence)).toBeGreaterThan(findRepos);

  const noConfirmStart = skill.search(/do not confirm/i);
  const noConfirm = skill.slice(noConfirmStart, findRepos);
  expect(noConfirm).not.toMatch(fleetFence);
  const invocations = [
    ...noConfirm.matchAll(/```(?:bash)?\n([^\n]*bun factory\/discover\.ts[^\n]*)\n```/g),
  ];
  expect(invocations.length).toBeGreaterThan(0);
  for (const m of invocations) {
    const cmd = (m[1] ?? "").trim();
    expect(cmd, cmd).toMatch(/--named owner\/name/);
    expect(cmd, cmd).toMatch(/--whitelist owner\/name/);
    expect(cmd, cmd).not.toMatch(/--owner\b/);
    const named = cmd.match(/--named\s+(\S+)/)?.[1];
    const whitelist = cmd.match(/--whitelist\s+(\S+)/)?.[1];
    expect(whitelist, "whitelist matches named").toBe(named);
  }
});

test("no hardcoded allowlist in discover sources", () => {
  const disc = readFileSync(join(ROOT, "factory/discover.ts"), "utf8");
  expect(disc).not.toMatch(/DanielKillenberger\/|ALLOWED_REPOS|allowlist\s*=\s*\[/);
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/no allowlist in this repo/i);
});

test("discover reuses exported owner/name helper", () => {
  const disc = readFileSync(join(ROOT, "factory/discover.ts"), "utf8");
  expect(disc).toMatch(/isRepoFullName/);
  const push = readFileSync(join(ROOT, "factory/lib/github_push.ts"), "utf8");
  expect(push).toMatch(/export function isRepoFullName/);
});

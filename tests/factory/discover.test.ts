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

function noHooks(label: string) {
  if (existsSync(`${ghLog}.hooks`)) {
    throw new Error(`${label} (hook mutate: ${readFileSync(`${ghLog}.hooks`, "utf8")})`);
  }
  expect(ghLogText(), label).not.toMatch(/\bhooks\b|\/hooks/);
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
  noHooks("happy path");
});

test("paginates past the 30-repo default", async () => {
  const res = await runDiscover([], "many");
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as { candidates: string[] };
  expect(body.candidates).toHaveLength(35);
  const limits = [...ghLogText().matchAll(/--limit(?:\s+|=)(\d+)/g)].map((m) => Number(m[1]));
  expect(limits.some((n) => n > 30)).toBe(true);
  noHooks("many");
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
  noHooks("named");
});

test("whitelist overlay does not fleet-scan", async () => {
  const res = await runDiscover(["--whitelist", "acme/app"]);
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as { candidates: string[] };
  expect(body.candidates).toEqual(["acme/app"]);
  expect(ghLogText()).not.toMatch(/repo list/);
  noHooks("whitelist");
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
    noHooks(label);
  });
}

test("skill waits for confirm and does not invoke hooks before it", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/Wait for an explicit confirmation reply/);
  expect(skill).toMatch(/only after that reply|only after confirm/i);
  expect(skill).toMatch(/bun factory\/hooks\.ts --confirmed/);
  expect(skill).toMatch(/Do not auto-init/);
  expect(skill).toMatch(/conversation, not a clicks-only UI/);
  expect(skill).not.toMatch(/hooks\.github\.com/);
});

test("no hardcoded allowlist in discover sources", () => {
  const disc = readFileSync(join(ROOT, "factory/discover.ts"), "utf8");
  expect(disc).not.toMatch(/DanielKillenberger\/|ALLOWED_REPOS|allowlist\s*=\s*\[/);
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/no allowlist in this repo/i);
});

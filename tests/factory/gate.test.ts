import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIX,
  GATE,
  ROOT,
  SHA,
  STUB_GH,
  factorySources,
  linkStub,
  makeBin,
  runBun,
  tempDir,
  trimNL,
} from "./helpers.ts";

let tmp = "";
let bin = "";
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
  rmSync(`${ghLog}.fleet`, { force: true });
  rmSync(`${ghLog}.429`, { force: true });
}

beforeEach(() => {
  tmp = tempDir();
  const made = makeBin(tmp);
  bin = made.bin;
  path = made.path;
  linkStub(bin, "gh", STUB_GH);
  ghLog = join(tmp, "gh.log");
  freshLog();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function noFleet(label: string) {
  if (existsSync(`${ghLog}.fleet`)) {
    throw new Error(`${label} (fleet-scan: ${readFileSync(`${ghLog}.fleet`, "utf8")})`);
  }
  const log = existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
  expect(log, label).not.toMatch(/repo list|repo ls|user\/repos|search\/repositories|\/orgs\//);
}

async function runGate(argv: string[] = [], stub = "empty", extra: Record<string, string | undefined> = {}, stdin?: string) {
  return runBun(GATE, argv, { env: env(stub, extra), stdin });
}

const identityQuiet: [string, string][] = [
  ["ping", "push-ping.json"],
  ["deleted", "push-deleted.json"],
  ["deleted-zero-sha", "push-deleted-zero-sha.json"],
  ["missing-identity", "push-missing.json"],
  ["wrong-types", "push-wrong-types.json"],
  ["invalid-owner-name", "push-invalid-name.json"],
  ["invalid-sha", "push-invalid-sha.json"],
  ["events-api-fields", "push-events-api.json"],
  ["not-json", "push-not-json.txt"],
];

for (const [label, file] of identityQuiet) {
  test(`${label} is quiet with no gh`, async () => {
    freshLog();
    const res = await runGate([join(FIX, file)]);
    expect(res.code, `${label} exit`).toBe(0);
    expect(trimNL(res.stdout), label).toBe("");
    noFleet(label);
    const log = existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
    expect(log.trim(), `${label} (gh invoked on identity quiet path)`).toBe("");
  });
}

test("no ready work is quiet", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "empty");
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
  noFleet("no ready work");
});

test("contents 404 quiet", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "membership_404");
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
  noFleet("contents 404 quiet");
});

test("ready spec/task starts pilot", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "pilot");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} pilot`);
  noFleet("ready spec/task starts");
});

test("land-only", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "land");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} land`);
});

test("mixed land+pilot", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "mixed");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} land`);
});

test("unclassifiable ready", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "unclassifiable");
  expect(res.code).toBe(20);
  expect(res.stderr.trim().length).toBeGreaterThan(0);
  noFleet("unclassifiable ready");
});

test("non-default-branch ref", async () => {
  const res = await runGate([join(FIX, "push-feature-branch.json")], "feature");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} pilot`);
});

test("unready and missing ready ignored", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "unready");
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("ready check only firing full_name+after", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "pilot");
  expect(res.code).toBe(10);
  const log = readFileSync(ghLog, "utf8");
  expect(log).toContain("repos/acme/app/");
  expect(log).toContain(`ref=${SHA}`);
  const other = log
    .split("\n")
    .filter((l) => /repos\/[^ ]+\//.test(l) && !l.includes("repos/acme/app/"));
  expect(other).toEqual([]);
});

test("gate never sets ready", async () => {
  await runGate([join(FIX, "push-ok.json")], "pilot");
  const log = readFileSync(ghLog, "utf8");
  expect(log).not.toMatch(/--method (PUT|PATCH|POST|DELETE)|spec ready/);
});

const stuckCases: [string, string][] = [
  ["malformed membership 200", "membership_malformed"],
  ["truncated directory listing", "truncated"],
  ["contents 403", "membership_403"],
  ["contents 5xx", "membership_500"],
  ["network", "network"],
  ["malformed sidecar", "malformed"],
  ["partial directory read", "partial"],
  ["malformed directory listing", "bad_listing"],
  ["malformed ready task", "bad_task"],
];

for (const [label, stub] of stuckCases) {
  test(label, async () => {
    const res = await runGate([join(FIX, "push-ok.json")], stub);
    expect(res.code, `${label} exit ${res.code} ${res.stderr}`).toBe(20);
    expect(res.stderr.trim().length, label).toBeGreaterThan(0);
    noFleet(label);
  });
}

test("missing sidecar dirs are quiet", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "missing_specs");
  expect(res.code).toBe(0);
});

test("punctuation-bearing git ref", async () => {
  const res = await runGate([join(FIX, "push-ref-punct.json")], "feature");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} pilot`);
});

test("429 retry then quiet", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "429_then_ok");
  expect(res.code).toBe(0);
});

test("stdin no ready work", async () => {
  const body = readFileSync(join(FIX, "push-ok.json"), "utf8");
  const res = await runGate([], "empty", {}, body);
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("whitelist miss is quiet and does not probe GitHub", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "pilot", {
    FACTORY_MEMBERSHIP_WHITELIST: "other/repo",
  });
  expect(res.code).toBe(0);
  const log = existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
  expect(log.trim()).toBe("");
});

test("whitelist hit starts", async () => {
  const res = await runGate(["--whitelist", "acme/app", join(FIX, "push-ok.json")], "pilot");
  expect(res.code).toBe(10);
  expect(trimNL(res.stdout)).toBe(`acme/app ${SHA} pilot`);
});

test("gh/git deadline maps hang to stuck", async () => {
  const res = await runGate([join(FIX, "push-ok.json")], "hang", {
    FACTORY_CMD_TIMEOUT_MS: "200",
  });
  expect(res.code).toBe(20);
  expect(res.stderr.trim().length).toBeGreaterThan(0);
});

test("no eval, no default-branch product default, no hardcoded allowlist, no live hook", async () => {
  for (const f of factorySources()) {
    const text = readFileSync(f, "utf8");
    expect(text, f).not.toMatch(/(^|[^A-Za-z0-9_])eval[\s(]/);
    expect(text, f).not.toMatch(/default_branch/);
    expect(text, f).not.toMatch(/ALLOWED_|allowlist\s*=/);
  }
  const glob = new Bun.Glob("{factory,tests/fixtures}/**/*");
  for (const p of glob.scanSync({ cwd: ROOT })) {
    const text = readFileSync(join(ROOT, p), "utf8");
    expect(text, p).not.toMatch(/api\.github.com\/repos\/.*\/hooks|hooks\.github/);
  }
});

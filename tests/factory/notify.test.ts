import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIX,
  GATE,
  NOTIFY,
  ROOT,
  SHA,
  SKILL,
  STUB_GH,
  STUB_HOST,
  TICK,
  linkStub,
  makeBin,
  makeProduct,
  runBun,
  tempDir,
  trimNL,
} from "./helpers.ts";

let tmp = "";
let bin = "";
let path = "";
let wt = "";
let notifyLog = "";
let ghLog = "";
let hostLog = "";
let pwdLog = "";
let cloudLog = "";
let product = "";
let sha = "";

beforeEach(() => {
  tmp = tempDir();
  const made = makeBin(tmp);
  bin = made.bin;
  path = made.path;
  wt = join(tmp, "wt");
  mkdirSync(wt, { recursive: true });
  linkStub(bin, "gh", STUB_GH);
  linkStub(bin, "grok", STUB_HOST);
  notifyLog = join(tmp, "notify.log");
  ghLog = join(tmp, "gh.log");
  hostLog = join(tmp, "host.log");
  pwdLog = join(tmp, "host.pwd");
  cloudLog = join(tmp, "cloud.log");
  writeFileSync(notifyLog, "");
  writeFileSync(ghLog, "");
  writeFileSync(hostLog, "");
  writeFileSync(pwdLog, "");
  writeFileSync(cloudLog, "");
  product = join(tmp, "product");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function env(extra: Record<string, string | undefined> = {}) {
  return {
    PATH: path,
    FACTORY_FIXTURES: FIX,
    FACTORY_NOTIFY_LOG: notifyLog,
    FACTORY_GH_LOG: ghLog,
    FACTORY_HOST_LOG: hostLog,
    FACTORY_HOST_PWD_LOG: pwdLog,
    FACTORY_CLOUD_LOG: cloudLog,
    FACTORY_HOST_HELP: "loop",
    FACTORY_HOST_VERDICT: "NO_WORK",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    FACTORY_MEMBERSHIP_WHITELIST: undefined,
    FACTORY_HOST: undefined,
    FACTORY_CLONE_URL: undefined,
    FACTORY_WORKTREE_ROOT: undefined,
    ...extra,
  };
}

async function runNotify(argv: string[]) {
  return runBun(NOTIFY, argv, { env: env() });
}

const eventTable: [string, string, "quiet" | string][] = [
  ["needs-human", "NEEDS_HUMAN", "NEEDS_HUMAN"],
  ["asked", "ASKED", "ASKED"],
  ["deferred", "DEFERRED_TO_LAND", "DEFERRED_TO_LAND"],
  ["send", "send", "send"],
  ["pay", "pay", "pay"],
  ["publish", "publish", "publish"],
  ["merge", "merge", "merge"],
  ["blocked", "BLOCKED", "NEEDS_HUMAN"],
  ["dirty-tree", "dirty-tree", "NEEDS_HUMAN"],
  ["picked-up", "picked up", "quiet"],
  ["still-running", "still running", "quiet"],
  ["pr-opened", "PR opened", "quiet"],
  ["no-work", "NO_WORK", "quiet"],
];

for (const [label, event, expectKind] of eventTable) {
  test(`notify ${label}`, async () => {
    writeFileSync(notifyLog, "");
    const res = await runNotify(["--event", event]);
    if (expectKind === "quiet") {
      expect(res.code).toBe(0);
      expect(trimNL(res.stdout)).toBe("");
      expect(readFileSync(notifyLog, "utf8").trim()).toBe("");
    } else {
      expect(res.code).toBe(0);
      const parsed = JSON.parse(res.stdout) as { event: string; path: string };
      expect(parsed.event).toBe(expectKind);
      expect(parsed.path).toBe("builder->main->human");
      expect(readFileSync(notifyLog, "utf8")).toContain('"event":');
    }
  });
}

test("from-exit 0 quiet", async () => {
  const res = await runNotify(["--from-exit", "0"]);
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("from-exit 10 start is quiet", async () => {
  const res = await runNotify(["--from-exit", "10", "--reason", `acme/app ${SHA} pilot`]);
  expect(res.code).toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("coordinator 403 → NEEDS_HUMAN", async () => {
  const gate = await runBun(GATE, [join(FIX, "push-ok.json")], {
    env: env({ FACTORY_STUB: "membership_403" }),
  });
  expect(gate.code).toBe(20);
  const res = await runNotify(["--from-exit", String(gate.code), "--reason", gate.stderr]);
  expect(res.code).toBe(0);
  const parsed = JSON.parse(res.stdout) as { event: string; reason: string };
  expect(parsed.event).toBe("NEEDS_HUMAN");
  expect(parsed.reason).toContain("403");
});

test("coordinator missing host → NEEDS_HUMAN", async () => {
  sha = await makeProduct(product, "none");
  const empty = join(tmp, "empty-path");
  mkdirSync(empty, { recursive: true });
  const tick = await runBun(
    TICK,
    ["--worktree-root", wt, "--clone-url", product, "acme/app", sha, "pilot"],
    { env: env({ PATH: `${empty}:/usr/bin:/bin` }) },
  );
  expect(tick.code).toBe(20);
  const res = await runNotify(["--from-exit", String(tick.code), "--reason", tick.stderr]);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
  expect(res.stdout.toLowerCase()).toContain("host");
});

test("coordinator pin-failure → NEEDS_HUMAN", async () => {
  sha = await makeProduct(product, "bogus");
  const tick = await runBun(
    TICK,
    [
      "--host",
      join(bin, "grok"),
      "--worktree-root",
      wt,
      "--clone-url",
      product,
      "acme/app",
      sha,
      "pilot",
    ],
    { env: env({ PATH: `${bin}:/usr/bin:/bin` }) },
  );
  expect(tick.code).toBe(20);
  const res = await runNotify(["--from-exit", String(tick.code), "--reason", tick.stderr]);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
  expect(res.stdout.toLowerCase()).toContain("pin");
});

test("from-exit ASKED", async () => {
  const res = await runNotify(["--from-exit", "20", "--reason", "host verdict ASKED"]);
  expect(JSON.parse(res.stdout).event).toBe("ASKED");
});

test("from-exit DEFERRED_TO_LAND", async () => {
  const res = await runNotify(["--from-exit", "20", "--reason", "host verdict DEFERRED_TO_LAND"]);
  expect(JSON.parse(res.stdout).event).toBe("DEFERRED_TO_LAND");
});

test("from-exit BLOCKED → NEEDS_HUMAN", async () => {
  const res = await runNotify(["--from-exit", "20", "--reason", "host verdict BLOCKED"]);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
});

test("from-exit 1 → NEEDS_HUMAN", async () => {
  const res = await runNotify(["--from-exit", "1"]);
  expect(res.code).toBe(0);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
});

test("from-exit 127 → NEEDS_HUMAN", async () => {
  const res = await runNotify(["--from-exit", "127"]);
  expect(res.code).toBe(0);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
});

test("from-exit 99 → NEEDS_HUMAN", async () => {
  const res = await runNotify(["--from-exit", "99"]);
  expect(res.code).toBe(0);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
});

test("from-exit abc is stuck", async () => {
  const res = await runNotify(["--from-exit", "abc"]);
  expect(res.code).not.toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("from-exit 20x is stuck", async () => {
  const res = await runNotify(["--from-exit", "20x"]);
  expect(res.code).not.toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("from-exit empty is stuck", async () => {
  const res = await runNotify(["--from-exit="]);
  expect(res.code).not.toBe(0);
  expect(trimNL(res.stdout)).toBe("");
});

test("dirty-tree reason → NEEDS_HUMAN", async () => {
  const res = await runNotify(["--from-exit", "20", "--reason", "dirty working tree at tick start"]);
  expect(JSON.parse(res.stdout).event).toBe("NEEDS_HUMAN");
});

test("builder skill contract", () => {
  const skill = readFileSync(SKILL, "utf8");
  expect(skill).toMatch(/factory\/gate\.ts/);
  expect(skill.toLowerCase()).toContain("no model");
  expect(skill.toLowerCase()).toMatch(/fail closed|do not start a model/);
  expect(
    /main is the stuck/i.test(skill) ||
      /stuck-notify hop/i.test(skill) ||
      /Main does not own the routine/i.test(skill),
  ).toBe(true);
  expect(/you own the webhook routine/i.test(skill) || /builder owns/i.test(skill)).toBe(true);
});

test("README contracts", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const skill = readFileSync(SKILL, "utf8");
  expect(readme + skill).not.toContain("cursor:gpt-5.6-sol-high");
  expect(readme.toLowerCase()).not.toMatch(/runbook only/);
  expect(readme).toContain("factory/gate.ts");
  expect(readme.toLowerCase()).toContain("hand");
  expect(
    /easy-install is later/i.test(readme) || /not required/i.test(readme),
  ).toBe(true);
  expect(readme.toLowerCase()).toContain("instance host cli");
  expect(readme.toLowerCase()).toContain("review pin");
  expect(readme.toLowerCase()).toContain("do not arm");
  expect(/don't arm|does not arm|do not arm/i.test(changelog)).toBe(true);
});

test("no live hook or eval in notify", () => {
  const notify = readFileSync(join(ROOT, "factory/notify.ts"), "utf8");
  const skillDir = readFileSync(SKILL, "utf8");
  expect(notify + skillDir).not.toMatch(/api\.github.com\/repos\/.*\/hooks|hooks\.github/);
  expect(notify).not.toMatch(/(^|[^A-Za-z0-9_])eval[\s(]/);
});

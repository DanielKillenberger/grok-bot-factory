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

const README_EASY_INSTALL_BEATS = [
  "Orient",
  "Find repos",
  "You pick",
  "Builder/webhook",
  "Paste two secrets",
  "Done",
] as const;

const README_BEAT_ACTION: Record<(typeof README_EASY_INSTALL_BEATS)[number], RegExp> = {
  Orient: /Confirm you understand/,
  "Find repos": /bun factory\/discover\.ts/,
  "You pick": /Wait for an explicit confirmation reply/,
  "Builder/webhook": /Assign an existing builder/,
  "Paste two secrets": /Paste `GROK_BOT_WEBHOOK_URL`/,
  Done: /Stop\. Do not recap/,
};

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

  const easy = readme.split("## Easy-install")[1]?.split(/^## /m)[0] ?? "";
  const numbered = [
    ...easy.matchAll(/^\d+\.\s+\*\*([^*]+)\*\*\s+—\s+(\S.*)$/gm),
  ];
  expect(numbered.map((m) => m[1])).toEqual([...README_EASY_INSTALL_BEATS]);
  for (const m of numbered) {
    const title = m[1] as (typeof README_EASY_INSTALL_BEATS)[number];
    const body = m[2] ?? "";
    const why = body.split(/(?<=\.)\s+/)[0] ?? "";
    const action = body.slice(why.length).trim();
    expect(why, `${title} why`).toMatch(/[A-Za-z].{10,}/);
    expect(action, `${title} action`).toMatch(/[A-Za-z].{10,}/);
    expect(action, `${title} expected action`).toMatch(README_BEAT_ACTION[title]);
  }
  expect(changelog.toLowerCase()).toMatch(/walkthrough|short-beat/);
  expect(changelog.toLowerCase()).toMatch(/conversation-first/);
  expect(easy.toLowerCase()).toMatch(/later-proof/);
  expect(easy.toLowerCase()).toMatch(/after the skill ships/);
  expect(easy).toMatch(/No-builder/);
  expect(easy).toMatch(/Existing-builder/);
  expect(easy.toLowerCase()).toMatch(/create a new builder \+ webhook/);
  expect(easy.toLowerCase()).toMatch(/live teammates do not count/);
  expect(easy.toLowerCase()).toMatch(/designated test builder/);
  expect(easy.toLowerCase()).toMatch(/do not create a third/);
  expect(easy.toLowerCase()).toMatch(/never the live factory builder/);
  expect(easy.toLowerCase()).toMatch(/live factory-wake webhook/);
  expect(easy.toLowerCase()).toMatch(/live secrets/);
  expect(easy.toLowerCase()).toMatch(/do not arm live factory-wake/);
  expect(easy.toLowerCase()).toMatch(/no second login/);
  expect(easy.toLowerCase()).toMatch(/throwaway product repo/);
  expect(easy.toLowerCase()).toMatch(/second main/);
  expect(easy.toLowerCase()).toMatch(/shared computer and github/);
});

test("README Easy-install documents post-tick commit/push; ADVANCED dirty/unpushed is fail", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const easy = readme.split("## Easy-install")[1]?.split(/^## /m)[0] ?? "";
  expect(easy).toMatch(/After every factory tick/);
  expect(easy).toMatch(/if the tree moved/);
  expect(easy).toMatch(/commit \(if needed\) and push to the spec branch/);
  expect(easy).toMatch(/ADVANCED with a dirty or unpushed tree is a fail, not quiet success/);
  const done = [
    ...easy.matchAll(/^\d+\.\s+\*\*([^*]+)\*\*\s+—\s+(\S.*)$/gm),
  ].find((m) => m[1] === "Done")?.[2] ?? "";
  expect(done).toMatch(/After every factory tick/);
  expect(done).toMatch(/commit \(if needed\) and push to the spec branch/);
  expect(done).toMatch(/ADVANCED with a dirty or unpushed tree is a fail, not quiet success/);
  expect(done).toMatch(/Stop\. Do not recap/);
});

test("no live hook or eval in notify", () => {
  const notify = readFileSync(join(ROOT, "factory/notify.ts"), "utf8");
  const skillDir = readFileSync(SKILL, "utf8");
  expect(notify + skillDir).not.toMatch(/api\.github.com\/repos\/.*\/hooks|hooks\.github/);
  expect(notify).not.toMatch(/(^|[^A-Za-z0-9_])eval[\s(]/);
});

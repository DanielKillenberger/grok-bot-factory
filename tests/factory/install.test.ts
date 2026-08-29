import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  INSTALL,
  ROOT,
  SKILL_EASY_INSTALL,
  STUB_GH_INSTALL,
  linkStub,
  makeBin,
  runBun,
  tempDir,
} from "./helpers.ts";

let tmp = "";
let path = "";
let ghLog = "";

const scheme = "https://";
const host = "example.invalid";
const routineUrl = `${scheme}${host}/wh-test`;
const senderKey = ["s3cr3t", "value", "0123456789abcd"].join("");
const template = readFileSync(join(ROOT, ".github/workflows/factory-forward.yml"), "utf8");

function env(stub: string, extra: Record<string, string | undefined> = {}) {
  return {
    PATH: path,
    FACTORY_GH_LOG: ghLog,
    FACTORY_STUB: stub,
    FACTORY_ROUTINE_URL: routineUrl,
    FACTORY_SENDER_KEY: senderKey,
    FACTORY_HOST: "grok",
    FACTORY_MEMBERSHIP_WHITELIST: undefined,
    FACTORY_TEMPLATE_FILE: join(ROOT, ".github/workflows/factory-forward.yml"),
    ...extra,
  };
}

function freshLog() {
  writeFileSync(ghLog, "");
  rmSync(`${ghLog}.hooks`, { force: true });
  rmSync(`${ghLog}.secrets`, { force: true });
  rmSync(`${ghLog}.put`, { force: true });
  rmSync(`${ghLog}.body`, { force: true });
  rmSync(`${ghLog}.409`, { force: true });
}

beforeEach(() => {
  tmp = tempDir();
  const made = makeBin(tmp);
  path = made.path;
  linkStub(made.bin, "gh", STUB_GH_INSTALL);
  ghLog = join(tmp, "gh.log");
  freshLog();
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function ghLogText(): string {
  return existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
}

function hookMutates(): string {
  return existsSync(`${ghLog}.hooks`) ? readFileSync(`${ghLog}.hooks`, "utf8") : "";
}

function puts(): string {
  return existsSync(`${ghLog}.put`) ? readFileSync(`${ghLog}.put`, "utf8") : "";
}

function secrets(): string {
  return existsSync(`${ghLog}.secrets`) ? readFileSync(`${ghLog}.secrets`, "utf8") : "";
}

async function runInstall(
  argv: string[],
  stub = "ok",
  extra: Record<string, string | undefined> = {},
) {
  return runBun(INSTALL, argv, { env: env(stub, extra) });
}

test("refuses missing --confirmed and writes nothing", async () => {
  const res = await runInstall([]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/--confirmed is required/);
  expect(puts()).toBe("");
  expect(secrets()).toBe("");
  expect(hookMutates()).toBe("");

  const candidates = await runInstall(["--candidates", "acme/app"]);
  expect(candidates.code).toBe(20);
  expect(candidates.stderr).toMatch(/unconfirmed input refused/);
  expect(puts()).toBe("");
});

test("refuses positional repos without --confirmed", async () => {
  const res = await runInstall(["acme/app"]);
  expect(res.code).toBe(20);
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(puts()).toBe("");
});

test("refuses candidate JSON as confirmed", async () => {
  const res = await runInstall(["--confirmed", '{"candidates":["acme/app"]}']);
  expect(res.code).toBe(20);
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(puts()).toBe("");
  expect(secrets()).toBe("");
});

test("after confirm, only the confirmed set is mutated", async () => {
  const res = await runInstall(["--confirmed", "acme/app"]);
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: unknown[];
    routine_first_action: string;
    coordinator: string;
    host: string;
    pin: string;
    builder: string;
    routine: string;
    model_first: boolean;
  };
  expect(body.succeeded).toEqual(["acme/app"]);
  expect(body.failed).toEqual([]);
  expect(body.routine_first_action).toBe("bun factory/gate.ts");
  expect(body.coordinator).toBe("skills/factory-coordinator/SKILL.md");
  expect(body.model_first).toBe(false);
  expect(body.host).toBe("grok");
  expect(body.pin).toBe("keep");
  expect(body.builder).toBe("assign-existing");
  expect(body.routine).toBe("reuse");
  expect(puts()).toMatch(/PUT/);
  expect(puts()).toMatch(/acme\/app/);
  expect(puts()).not.toMatch(/acme\/lib/);
  expect(secrets()).toMatch(/GROK_BOT_WEBHOOK_URL/);
  expect(secrets()).toMatch(/GROK_BOT_SENDER_KEY/);
  expect(hookMutates()).toBe("");
  expect(res.stdout).not.toContain(senderKey);
  expect(res.stdout).not.toContain(routineUrl);
  expect(puts()).toContain(Buffer.from(template).toString("base64"));
  expect(template).toMatch(/factory-forward repo=/);
  expect(template).toMatch(/Authorization: Bearer/);
});

test("existing matching workflow skips PUT but still sets secrets", async () => {
  const res = await runInstall(["--confirmed", "acme/app"], "same");
  expect(res.code).toBe(0);
  expect(puts()).toBe("");
  expect(secrets()).toMatch(/GROK_BOT_WEBHOOK_URL/);
  expect(JSON.parse(res.stdout).succeeded).toEqual(["acme/app"]);
});

test("stale workflow is updated with sha", async () => {
  const res = await runInstall(["--confirmed", "acme/app"], "stale");
  expect(res.code).toBe(0);
  expect(puts()).toMatch(/PUT/);
  expect(puts()).toMatch(/sha=oldsha/);
});

test("PUT 409 re-GETs and converges", async () => {
  const res = await runInstall(["--confirmed", "acme/app"], "put_409");
  expect(res.code).toBe(0);
  expect(puts()).toMatch(/PUT/);
  expect(JSON.parse(res.stdout).succeeded).toEqual(["acme/app"]);
});

test("missing routine URL or sender key fails closed with no writes", async () => {
  const noUrl = await runInstall(["--confirmed", "acme/app"], "ok", {
    FACTORY_ROUTINE_URL: "",
    GROK_BOT_WEBHOOK_URL: "",
  });
  expect(noUrl.code).toBe(20);
  expect(noUrl.stderr).toMatch(/routine URL and sender key are required/);
  expect(puts()).toBe("");
  expect(secrets()).toBe("");

  const noKey = await runInstall(["--confirmed", "acme/app"], "ok", {
    FACTORY_SENDER_KEY: "",
    GROK_BOT_SENDER_KEY: "",
  });
  expect(noKey.code).toBe(20);
  expect(puts()).toBe("");
});

test("create-if-none only when no builder exists; re-run reuses routine", async () => {
  const created = await runInstall(
    ["--confirmed", "acme/app", "--builder-exists", "0", "--create-routine", "yes"],
    "ok",
  );
  expect(created.code).toBe(0);
  expect(JSON.parse(created.stdout).builder).toBe("create-if-none");
  expect(JSON.parse(created.stdout).routine).toBe("create");

  const assigned = await runInstall(
    ["--confirmed", "acme/app", "--builder-exists", "1"],
    "ok",
  );
  expect(assigned.code).toBe(0);
  expect(JSON.parse(assigned.stdout).builder).toBe("assign-existing");
  expect(JSON.parse(assigned.stdout).routine).toBe("reuse");
});

test("partial failure reports succeeded and failed; no rollback", async () => {
  const res = await runInstall(["--confirmed", "acme/app,acme/lib"], "partial");
  expect(res.code).toBe(20);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: { repo: string; reason: string }[];
  };
  expect(body.succeeded).toEqual(["acme/app"]);
  expect(body.failed[0]?.repo).toBe("acme/lib");
  expect(puts()).toMatch(/acme\/app/);
});

test("skill documents Action install after confirm, not Settings hooks", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/bun factory\/install\.ts --confirmed/);
  expect(skill).toMatch(/Wait for an explicit confirmation reply/);
  expect(skill).toMatch(/Do not overwrite/);
  expect(skill).not.toMatch(/factory\/hooks\.ts/);
});

test("no Settings-hook REST in install sources", () => {
  const src = readFileSync(join(ROOT, "factory/install.ts"), "utf8");
  expect(src).not.toMatch(/api\.github.com\/repos\/.*\/hooks|hooks\.github/);
  expect(src).not.toMatch(/name:\s*["']web["']/);
});

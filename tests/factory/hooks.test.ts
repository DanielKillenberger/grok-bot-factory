import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  HOOKS,
  ROOT,
  SKILL_EASY_INSTALL,
  STUB_GH_HOOKS,
  linkStub,
  makeBin,
  makeProduct,
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

function env(stub: string, extra: Record<string, string | undefined> = {}) {
  return {
    PATH: path,
    FACTORY_GH_LOG: ghLog,
    FACTORY_STUB: stub,
    FACTORY_ROUTINE_URL: routineUrl,
    FACTORY_SENDER_KEY: senderKey,
    FACTORY_HOST: "grok",
    FACTORY_MEMBERSHIP_WHITELIST: undefined,
    FACTORY_PANEL_ROUTINE: undefined,
    ...extra,
  };
}

function freshLog() {
  writeFileSync(ghLog, "");
  rmSync(`${ghLog}.hooks`, { force: true });
  rmSync(`${ghLog}.body`, { force: true });
  rmSync(`${ghLog}.state`, { force: true });
  rmSync(`${ghLog}.429`, { force: true });
  rmSync(`${ghLog}.422`, { force: true });
}

beforeEach(() => {
  tmp = tempDir();
  const made = makeBin(tmp);
  path = made.path;
  linkStub(made.bin, "gh", STUB_GH_HOOKS);
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

function bodies(): string {
  return existsSync(`${ghLog}.body`) ? readFileSync(`${ghLog}.body`, "utf8") : "";
}

async function runHooks(
  argv: string[],
  stub = "ok",
  extra: Record<string, string | undefined> = {},
) {
  return runBun(HOOKS, argv, { env: env(stub, extra) });
}

test("refuses missing --confirmed and writes no hooks", async () => {
  const res = await runHooks([]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/--confirmed is required/);
  expect(hookMutates()).toBe("");

  const candidates = await runHooks(["--candidates", "acme/app"]);
  expect(candidates.code).toBe(20);
  expect(candidates.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toBe("");
});

test("refuses positional repos without --confirmed", async () => {
  const res = await runHooks(["acme/app"]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toBe("");
});

test("refuses candidate JSON as confirmed", async () => {
  const res = await runHooks(["--confirmed", '{"candidates":["acme/app"]}']);
  expect(res.code).toBe(20);
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toBe("");
});

test("after confirm, only the confirmed set is mutated", async () => {
  const res = await runHooks(["--confirmed", "acme/app"]);
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
  expect(body.coordinator).toBe("bun factory/tick.ts");
  expect(body.model_first).toBe(false);
  expect(body.host).toBe("grok");
  expect(body.pin).toBe("keep");
  expect(body.builder).toBe("assign-existing");
  expect(body.routine).toBe("reuse");
  expect(hookMutates()).toMatch(/POST/);
  expect(hookMutates()).not.toMatch(/acme\/lib/);
  expect(ghLogText()).toMatch(/--paginate/);
  expect(res.stdout).not.toContain(senderKey);
  expect(res.stdout).not.toContain(routineUrl);
});

test("zero matching URL POSTs web push hook; one matching URL PATCHes secret", async () => {
  const created = await runHooks(["--confirmed", "acme/app"], "ok");
  expect(created.code).toBe(0);
  expect(hookMutates()).toMatch(/POST/);
  expect(bodies()).toMatch(/"name":"web"/);
  expect(bodies()).toMatch(/"events":\["push"\]/);
  expect(bodies()).toMatch(/"content_type":"json"/);
  expect(bodies()).toMatch(/"insecure_ssl":"0"/);
  expect(bodies()).toContain(senderKey);
  expect(bodies()).toContain(routineUrl);

  freshLog();
  const patched = await runHooks(["--confirmed", "acme/app"], "one");
  expect(patched.code).toBe(0);
  expect(hookMutates()).toMatch(/PATCH/);
  expect(hookMutates()).not.toMatch(/POST/);
  expect(bodies()).toContain(senderKey);
  expect(bodies()).toMatch(/"events":\["push"\]/);
  expect(bodies()).toMatch(/"active":true/);
  expect(JSON.parse(patched.stdout).succeeded).toEqual(["acme/app"]);
});

test("other URL is not treated as equivalent; still POSTs", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "other");
  expect(res.code).toBe(0);
  expect(hookMutates()).toMatch(/POST/);
});

test("duplicate URL matches are reported, not guessed", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "dup");
  expect(res.code).toBe(20);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: { repo: string; reason: string }[];
  };
  expect(body.succeeded).toEqual([]);
  expect(body.failed).toEqual([{ repo: "acme/app", reason: "ambiguous hooks" }]);
  expect(hookMutates()).toBe("");
});

test("POST 422 re-GETs and converges with PATCH", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "post_422");
  expect(res.code).toBe(0);
  expect(hookMutates()).toMatch(/POST/);
  expect(hookMutates()).toMatch(/PATCH/);
  expect(JSON.parse(res.stdout).succeeded).toEqual(["acme/app"]);
});

test("paginates hook GET and PATCHes a match past the first page", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "many");
  expect(res.code).toBe(0);
  expect(hookMutates()).toMatch(/PATCH/);
  expect(hookMutates()).not.toMatch(/POST/);
  expect(ghLogText()).toMatch(/--paginate/);
});

test("missing routine URL or sender key fails closed with no writes", async () => {
  const noUrl = await runHooks(["--confirmed", "acme/app"], "ok", {
    FACTORY_ROUTINE_URL: "",
  });
  expect(noUrl.code).toBe(20);
  expect(noUrl.stderr).toMatch(/routine URL and sender key are required/);
  expect(hookMutates()).toBe("");

  const noKey = await runHooks(["--confirmed", "acme/app"], "ok", {
    FACTORY_SENDER_KEY: "",
  });
  expect(noKey.code).toBe(20);
  expect(hookMutates()).toBe("");
});

test("create-if-none only when no builder exists; re-run reuses routine", async () => {
  const created = await runHooks(
    ["--confirmed", "acme/app", "--builder-exists", "0", "--create-routine", "yes"],
    "ok",
  );
  expect(created.code).toBe(0);
  expect(JSON.parse(created.stdout).builder).toBe("create-if-none");
  expect(JSON.parse(created.stdout).routine).toBe("create");

  const assigned = await runHooks(
    ["--confirmed", "acme/app", "--builder-exists", "1"],
    "ok",
  );
  expect(assigned.code).toBe(0);
  expect(JSON.parse(assigned.stdout).builder).toBe("assign-existing");
  expect(JSON.parse(assigned.stdout).routine).toBe("reuse");

  const mint = await runHooks(
    ["--confirmed", "acme/app", "--create-routine", "yes"],
    "ok",
    { FACTORY_PANEL_ROUTINE: "webhook" },
  );
  expect(mint.code).toBe(20);
  expect(mint.stderr).toMatch(/do not mint a second/);
  expect(mint.stdout.trim()).toBe("");
});

test("partial failure reports and does not roll back successes", async () => {
  const res = await runHooks(["--confirmed", "acme/app,acme/fail"], "partial");
  expect(res.code).toBe(20);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: { repo: string; reason: string }[];
  };
  expect(body.succeeded).toEqual(["acme/app"]);
  expect(body.failed[0]?.repo).toBe("acme/fail");
  expect(hookMutates()).toMatch(/acme\/app/);
  expect(hookMutates()).not.toMatch(/DELETE/);
});

test("malformed owner/name fails closed before writes", async () => {
  const res = await runHooks(["--confirmed", "acme/app/typo"]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/invalid repo name/);
  expect(hookMutates()).toBe("");
});

test("listing failures fail that repo closed", async () => {
  for (const [label, stub] of [
    ["401", "get_401"],
    ["403", "get_403"],
    ["429", "get_429"],
    ["5xx", "get_500"],
    ["network", "network"],
    ["malformed", "malformed"],
  ] as const) {
    freshLog();
    const res = await runHooks(["--confirmed", "acme/app"], stub);
    expect(res.code, label).toBe(20);
    const body = JSON.parse(res.stdout) as { failed: { reason: string }[] };
    expect(body.failed[0]?.reason, label).toMatch(/gh |malformed/);
    expect(hookMutates(), label).toBe("");
  }
});

test("does not overwrite a product review pin", async () => {
  const checkout = join(tmp, "product");
  await makeProduct(checkout, "cursor:gpt-5.6-sol-high", true);
  const beforeCfg = readFileSync(join(checkout, ".flow/config.json"), "utf8");
  const beforeRouting = readFileSync(join(checkout, "CLAUDE.md"), "utf8");
  const res = await runHooks(["--confirmed", "acme/app", "--host", "grok"]);
  expect(res.code).toBe(0);
  expect(readFileSync(join(checkout, ".flow/config.json"), "utf8")).toBe(beforeCfg);
  expect(readFileSync(join(checkout, "CLAUDE.md"), "utf8")).toBe(beforeRouting);
  expect(JSON.parse(res.stdout).pin).toBe("keep");
  expect(JSON.parse(res.stdout).host).toBe("grok");
  const src = readFileSync(join(ROOT, "factory/hooks.ts"), "utf8");
  expect(src).not.toMatch(/flow-next:setup|writeFileSync|config\.json/);
});

test("skill assigns existing builder, reuses routine, gate-first, confirm-then-hooks", () => {
  const skill = readFileSync(SKILL_EASY_INSTALL, "utf8");
  expect(skill).toMatch(/Assign an existing builder/);
  expect(skill).toMatch(/Create one only if none exists/);
  expect(skill).toMatch(/do not mint a second routine/i);
  expect(skill).toMatch(/bun factory\/gate\.ts/);
  expect(skill).toMatch(/no model/i);
  expect(skill).toMatch(/bun factory\/hooks\.ts --confirmed/);
  expect(skill).toMatch(/owner paste/i);
  expect(skill).toMatch(/Do not overwrite/);
  expect(skill).not.toMatch(/hooks\.github\.com/);
  expect(skill).toMatch(/Do not invent a Grok Bot REST client/);
});

test("README documents send-to-main easy-install and keeps hand-wire", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  expect(readme).toMatch(/send this repo to your \*\*main\*\* Grok Bot agent/i);
  expect(readme).toMatch(/Wake \(happy path\)/);
  expect(readme).toMatch(/Hand-wire/);
  const changelog = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  expect(changelog).toMatch(/easy-install/i);
});

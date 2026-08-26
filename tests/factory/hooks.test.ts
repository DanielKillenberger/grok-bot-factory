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
    ...extra,
  };
}

function freshLog() {
  writeFileSync(ghLog, "");
  rmSync(`${ghLog}.hooks`, { force: true });
  rmSync(`${ghLog}.state`, { force: true });
  rmSync(`${ghLog}.429`, { force: true });
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

function hookMutates(): { method: string; repo: string; body?: { config?: { secret?: string } } }[] {
  if (!existsSync(`${ghLog}.hooks`)) return [];
  return readFileSync(`${ghLog}.hooks`, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { method: string; repo: string; body?: { config?: { secret?: string } } });
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
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toEqual([]);

  const candidates = await runHooks(["--candidates", "acme/app"]);
  expect(candidates.code).toBe(20);
  expect(candidates.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toEqual([]);
});

test("refuses positional repos without --confirmed", async () => {
  const res = await runHooks(["acme/app"]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/unconfirmed input refused/);
  expect(hookMutates()).toEqual([]);
});

test("refuses candidate JSON as confirmed", async () => {
  const res = await runHooks(["--confirmed", '{"candidates":["acme/app"]}']);
  expect(res.code).toBe(20);
  expect(res.stderr).toMatch(/unconfirmed input refused|invalid repo name/);
  expect(hookMutates()).toEqual([]);
});

test("after confirm, only the confirmed set is mutated", async () => {
  const res = await runHooks(["--confirmed", "acme/app"]);
  expect(res.code).toBe(0);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: unknown[];
    builder: string;
    routine: {
      command: string;
      model: boolean;
      then: string;
      host_cli: string;
      pin: string;
      first_action: string;
      type: string;
    };
  };
  expect(body.succeeded).toEqual(["acme/app"]);
  expect(body.failed).toEqual([]);
  expect(body.builder).toBe("assign-existing-or-create-if-none");
  expect(body.routine.type).toBe("webhook");
  expect(body.routine.first_action).toBe("exec");
  expect(body.routine.command).toBe("bun factory/gate.ts");
  expect(body.routine.model).toBe(false);
  expect(body.routine.then).toBe("coordinator/tick");
  expect(body.routine.host_cli).toBe("grok");
  expect(body.routine.pin).toBe("preserve");
  expect(hookMutates().map((m) => m.method)).toEqual(["POST"]);
  expect(hookMutates()[0]?.repo).toBe("acme/app");
  expect(hookMutates().some((m) => m.repo === "acme/lib")).toBe(false);
  expect(ghLogText()).toMatch(/per_page=30/);
});

test("zero matching URL POSTs web push hook; one matching URL PATCHes secret", async () => {
  const created = await runHooks(["--confirmed", "acme/app"], "ok");
  expect(created.code).toBe(0);
  expect(hookMutates().map((m) => m.method)).toEqual(["POST"]);
  const postBody = JSON.stringify(hookMutates()[0]?.body ?? {});
  expect(postBody).toMatch(/"name":"web"/);
  expect(postBody).toMatch(/"events":\["push"\]/);
  expect(postBody).toMatch(/"content_type":"json"/);
  expect(postBody).toMatch(/"insecure_ssl":"0"/);
  expect(postBody).toContain(senderKey);
  expect(postBody).toContain(routineUrl);

  freshLog();
  const patched = await runHooks(["--confirmed", "acme/app"], "one_match");
  expect(patched.code).toBe(0);
  expect(hookMutates().map((m) => m.method)).toEqual(["PATCH"]);
  const patch = hookMutates()[0]?.body as {
    active?: boolean;
    events?: string[];
    config?: { secret?: string; content_type?: string; insecure_ssl?: string };
  };
  expect(patch.active).toBe(true);
  expect(patch.events).toEqual(["push"]);
  expect(patch.config?.secret).toBe(senderKey);
  expect(patch.config?.secret).not.toBe("********");
  expect(patch.config?.content_type).toBe("json");
  expect(patch.config?.insecure_ssl).toBe("0");
  expect(JSON.parse(patched.stdout).succeeded).toEqual(["acme/app"]);
});

test("other URL is not treated as equivalent; still POSTs", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "other");
  expect(res.code).toBe(0);
  expect(hookMutates().map((m) => m.method)).toEqual(["POST"]);
});

test("duplicate URL matches are reported, not guessed", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "dup_match");
  expect(res.code).toBe(20);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: { repo: string; reason: string }[];
  };
  expect(body.succeeded).toEqual([]);
  expect(body.failed[0]?.repo).toBe("acme/app");
  expect(body.failed[0]?.reason).toMatch(/duplicate/);
  expect(hookMutates()).toEqual([]);
});

test("POST 422 re-GETs and converges with PATCH", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "post_422");
  expect(res.code).toBe(0);
  expect(hookMutates().map((m) => m.method)).toEqual(["POST", "PATCH"]);
  expect(JSON.parse(res.stdout).succeeded).toEqual(["acme/app"]);
});

test("missing routine URL or sender key fails closed with no writes", async () => {
  const noUrl = await runHooks(["--confirmed", "acme/app"], "ok", {
    FACTORY_ROUTINE_URL: "",
  });
  expect(noUrl.code).toBe(20);
  expect(noUrl.stderr).toMatch(/missing routine URL or sender key/);
  expect(hookMutates()).toEqual([]);

  const noKey = await runHooks(["--confirmed", "acme/app"], "ok", {
    FACTORY_SENDER_KEY: "",
  });
  expect(noKey.code).toBe(20);
  expect(hookMutates()).toEqual([]);
});

test("paginates GET hooks and PATCHes a unique URL on a later page", async () => {
  const res = await runHooks(["--confirmed", "acme/app"], "many");
  expect(res.code).toBe(0);
  expect(ghLogText()).toMatch(/page=2/);
  expect(hookMutates().map((m) => m.method)).toEqual(["PATCH"]);
});

test("partial failure reports and does not roll back successes", async () => {
  const res = await runHooks(["--confirmed", "acme/app,acme/lib"], "partial");
  expect(res.code).toBe(20);
  const body = JSON.parse(res.stdout) as {
    succeeded: string[];
    failed: { repo: string; reason: string }[];
  };
  expect(body.succeeded).toEqual(["acme/app"]);
  expect(body.failed[0]?.repo).toBe("acme/lib");
  expect(hookMutates().some((m) => m.repo === "acme/app")).toBe(true);
  expect(hookMutates().some((m) => m.method === "DELETE")).toBe(false);
});

test("malformed owner/name fails closed before writes", async () => {
  const res = await runHooks(["--confirmed", "acme/app/typo"]);
  expect(res.code).toBe(20);
  expect(res.stdout.trim()).toBe("");
  expect(res.stderr).toMatch(/invalid repo name/);
  expect(hookMutates()).toEqual([]);
});

test("listing failures fail that repo closed", async () => {
  for (const [label, stub] of [
    ["403", "list_403"],
    ["5xx", "list_500"],
    ["network", "network"],
    ["malformed", "malformed"],
  ] as const) {
    freshLog();
    const res = await runHooks(["--confirmed", "acme/app"], stub);
    expect(res.code, label).toBe(20);
    const body = JSON.parse(res.stdout) as { failed: { reason: string }[] };
    expect(body.failed[0]?.reason, label).toMatch(/gh |malformed/);
    expect(hookMutates(), label).toEqual([]);
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
  expect(JSON.parse(res.stdout).routine.pin).toBe("preserve");
  expect(JSON.parse(res.stdout).routine.host_cli).toBe("grok");
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

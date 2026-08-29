import { afterEach, beforeEach, expect, test } from "bun:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  buildFactoryCheckWebhookPost,
  cancelBuildRunCheck,
  createNamedCheck,
  deleteCheck,
  factoryWebhookSecrets,
  isArmedCheck,
  postFactoryCheckWebhook,
  readCheckRoutine,
  webhookRepostClock,
} from "../../factory/lib/coordinator.ts";
import { CHECK_FIRE, ROOT, memoryCheckClock, runBun, tempDir } from "./helpers.ts";

const COORD_SKILL = join(ROOT, "skills/factory-coordinator/SKILL.md");

let home = "";

beforeEach(() => {
  home = tempDir();
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

test("createNamedCheck arms a real clock; delete and cancel disarm it", async () => {
  const clock = memoryCheckClock();
  const lease = {
    key: "acme/app fn-1",
    repo: "acme/app",
    specId: "fn-1",
    clientAgentId: "client",
  };
  const created = await createNamedCheck(home, lease, clock);
  expect(created).toEqual({ checkRoutineId: "factory-check:acme/app fn-1" });
  if ("error" in created) return;
  const routine = readCheckRoutine(home, created.checkRoutineId);
  expect(isArmedCheck(routine)).toBe(true);
  expect(routine?.handle).toBe(`clock:${created.checkRoutineId}`);
  expect(clock.arms).toEqual([created.checkRoutineId]);

  expect(await deleteCheck(home, created.checkRoutineId, clock)).toEqual({ deleted: true });
  expect(clock.disarms).toEqual([created.checkRoutineId]);
  expect(readCheckRoutine(home, created.checkRoutineId)).toBeNull();

  const again = await createNamedCheck(home, lease, clock);
  if ("error" in again) return;
  expect(await cancelBuildRunCheck(home, again.checkRoutineId, clock)).toEqual({ cancelled: true });
  expect(clock.disarms).toContain(again.checkRoutineId);
  expect(readCheckRoutine(home, again.checkRoutineId)).toBeNull();
});

test("createNamedCheck without a successful arm fails closed and writes no ledger clock", async () => {
  const refused = await createNamedCheck(home, {
    key: "acme/app fn-1",
    repo: "acme/app",
    specId: "fn-1",
    clientAgentId: "client",
  }, {
    arm: async () => ({ error: "cannot_create" }),
    disarm: async () => ({ disarmed: false }),
  });
  expect(refused).toEqual({ error: "cannot_create" });
  expect(readCheckRoutine(home, "factory-check:acme/app fn-1")).toBeNull();
});

test("webhook re-POST uses the shipped factory Bearer path and does not invent a Grok Bot REST client", async () => {
  const skill = readFileSync(COORD_SKILL, "utf8");
  expect(skill).toMatch(/re-POSTs the shipped factory webhook/);
  expect(skill).toMatch(/Do not invent a public Grok Bot REST client/);
  expect(readFileSync(join(ROOT, "factory/lib/coordinator.ts"), "utf8")).not.toMatch(
    /api\.x\.ai\/.*routin|docs\.x\.ai\/.*\/routines\/[A-Za-z0-9]/i,
  );
  expect(factoryWebhookSecrets({})).toEqual({ error: "cannot_create" });
  expect(
    factoryWebhookSecrets({
      GROK_BOT_WEBHOOK_URL: "https://example.invalid/wh",
      GROK_BOT_SENDER_KEY: "sender-key",
    }),
  ).toEqual({ url: "https://example.invalid/wh", key: "sender-key" });

  const req = buildFactoryCheckWebhookPost({
    url: "https://example.invalid/wh",
    key: "sender-key",
    repo: "acme/app",
    specId: "fn-1",
    purpose: "build-run",
    sha: "0123456789abcdef0123456789abcdef01234567",
  });
  expect(req.method).toBe("POST");
  expect(req.url).toBe("https://example.invalid/wh");
  expect(req.headers.Authorization).toBe("Bearer sender-key");
  expect(req.headers["User-Agent"]).toBe(
    "factory-check repo=acme/app spec=fn-1 sha=0123456789abcdef0123456789abcdef01234567 ref=refs/heads/fn-1",
  );
  expect(req.body).toMatch(/"kind":"factory-check"/);

  const posted: Array<{ url: string; init: RequestInit }> = [];
  const ok = await postFactoryCheckWebhook(
    {
      url: "https://example.invalid/wh",
      key: "sender-key",
      repo: "acme/app",
      specId: "fn-1",
      purpose: "build-run",
    },
    (async (url, init) => {
      posted.push({ url: String(url), init: init ?? {} });
      return new Response("ok", { status: 200 });
    }) as typeof fetch,
  );
  expect(ok).toEqual({ ok: true });
  expect(posted).toHaveLength(1);

  const clock = webhookRepostClock({
    secrets: { error: "cannot_create" },
    schedule: memoryCheckClock(),
  });
  expect(await clock.arm({
    id: "factory-check:acme/app fn-1",
    repo: "acme/app",
    specId: "fn-1",
    intervalMinutes: 30,
    purpose: "build-run",
    handle: "",
  })).toEqual({ error: "cannot_create" });
});

test("check-fire CLI re-POSTs the shipped webhook or fails closed without secrets", async () => {
  const missing = await runBun(CHECK_FIRE, ["--repo", "acme/app", "--spec", "fn-1"], {
    env: { GROK_BOT_WEBHOOK_URL: "", GROK_BOT_SENDER_KEY: "", FACTORY_ROUTINE_URL: "", FACTORY_SENDER_KEY: "" },
  });
  expect(missing.code).toBe(20);
  expect(missing.stderr).toMatch(/routine URL and sender key are required/);
});

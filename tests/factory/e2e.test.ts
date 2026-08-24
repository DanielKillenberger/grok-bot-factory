import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  FIX,
  GATE,
  NOTIFY,
  STUB_GH,
  STUB_HOST,
  TICK,
  linkStub,
  makeBin,
  makeProduct,
  runBun,
  runCmd,
  tempDir,
  trimNL,
} from "./helpers.ts";

/**
 * Stitched factory path as a webhook routine would run it locally:
 *   bun factory/gate.ts <payload>
 *   0  → stop (no host)
 *   20 → bun factory/notify.ts --from-exit 20 --reason <stderr>
 *   10 → bun factory/tick.ts --host <stub> --worktree-root … --clone-url …
 *         <gate stdout>
 *         then notify --from-exit <tick rc> --reason <tick stderr>
 * No live GitHub hook. No live Grok Bot routine. Stub gh + stub host only.
 */

let tmp = "";
let bin = "";
let path = "";
let wt = "";
let notifyLog = "";
let ghLog = "";
let hostLog = "";
let pwdLog = "";
let product = "";

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
  writeFileSync(notifyLog, "");
  writeFileSync(ghLog, "");
  writeFileSync(hostLog, "");
  writeFileSync(pwdLog, "");
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
    FACTORY_HOST_HELP: "loop",
    FACTORY_HOST_VERDICT: "NO_WORK",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    FACTORY_MEMBERSHIP_WHITELIST: undefined,
    FACTORY_HOST: undefined,
    FACTORY_CLONE_URL: undefined,
    FACTORY_WORKTREE_ROOT: undefined,
    FACTORY_HOST_EXIT: undefined,
    FACTORY_HOST_MUTATE: undefined,
    FACTORY_STUB_REPO: "acme/app",
    ...extra,
  };
}

function hostLogText(): string {
  return existsSync(hostLog) ? readFileSync(hostLog, "utf8") : "";
}

function hostInvoked(): boolean {
  return hostLogText().trim().length > 0;
}

/** Host --help probe is not a start. Start means /loop, /goal, or a flow-next skill. */
function hostStarted(): boolean {
  const h = hostLogText();
  return /(?:^|\s)\/(?:loop|goal|flow-next:)/.test(h);
}

function writePush(fullName: string, sha: string): string {
  const file = join(tmp, "push.json");
  writeFileSync(
    file,
    JSON.stringify({
      ref: "refs/heads/main",
      after: sha,
      deleted: false,
      repository: { full_name: fullName },
    }),
  );
  return file;
}

type Proc = { code: number; stdout: string; stderr: string };

type Routine = {
  gate: Proc;
  tick: Proc | null;
  notify: Proc;
};

async function runNotify(fromExit: number, reason = ""): Promise<Proc> {
  const argv = ["--from-exit", String(fromExit)];
  if (reason) argv.push("--reason", reason);
  return runBun(NOTIFY, argv, { env: env() });
}

/** Gate, then tick on start, then notify --from-exit. Matches the supervisor fire path. */
async function runRoutine(opts: {
  payload: string;
  stub: string;
  tick?: boolean;
  extra?: Record<string, string | undefined>;
  tickExtra?: Record<string, string | undefined>;
}): Promise<Routine> {
  const gate = await runBun(GATE, [opts.payload], {
    env: env({ FACTORY_STUB: opts.stub, ...opts.extra }),
  });
  if (gate.code === 0) {
    return { gate, tick: null, notify: await runNotify(0) };
  }
  if (gate.code === 20 || gate.code !== 10) {
    return { gate, tick: null, notify: await runNotify(gate.code, gate.stderr) };
  }
  if (opts.tick === false) {
    return { gate, tick: null, notify: await runNotify(10, gate.stdout) };
  }
  const start = trimNL(gate.stdout).split(/\s+/);
  const tick = await runBun(
    TICK,
    [
      "--host",
      join(bin, "grok"),
      "--worktree-root",
      wt,
      "--clone-url",
      product,
      ...start,
    ],
    { env: env({ FACTORY_STUB: opts.stub, ...opts.extra, ...opts.tickExtra }) },
  );
  return { gate, tick, notify: await runNotify(tick.code, tick.stderr) };
}

function expectQuietNotify(n: Proc, label: string) {
  expect(n.code, `${label} notify exit`).toBe(0);
  expect(trimNL(n.stdout), `${label} notify stdout`).toBe("");
  expect(readFileSync(notifyLog, "utf8").trim(), `${label} notify log`).toBe("");
}

function expectNeedsHuman(n: Proc, label: string) {
  expect(n.code, `${label} notify exit`).toBe(0);
  const parsed = JSON.parse(n.stdout) as { event: string; path: string };
  expect(parsed.event, `${label} event`).toBe("NEEDS_HUMAN");
  expect(parsed.path, `${label} path`).toBe("builder->main->human");
}

const quietFixtures: [string, string][] = [
  ["ping", "push-ping.json"],
  ["deleted", "push-deleted.json"],
  ["missing-identity", "push-missing.json"],
];

for (const [label, file] of quietFixtures) {
  test(`routine quiet: ${label} → gate 0, no host, notify quiet`, async () => {
    const r = await runRoutine({
      payload: join(FIX, file),
      stub: "pilot",
      tick: false,
    });
    expect(r.gate.code, `${label} gate`).toBe(0);
    expect(trimNL(r.gate.stdout), label).toBe("");
    expect(r.tick, `${label} must not start tick`).toBeNull();
    expect(hostInvoked(), `${label} host started`).toBe(false);
    expectQuietNotify(r.notify, label);
  });
}

test("routine quiet: not-member (whitelist miss) → gate 0, no gh, no host", async () => {
  const r = await runRoutine({
    payload: join(FIX, "push-ok.json"),
    stub: "pilot",
    extra: { FACTORY_MEMBERSHIP_WHITELIST: "other/repo" },
    tick: false,
  });
  expect(r.gate.code).toBe(0);
  expect(r.tick).toBeNull();
  expect(hostInvoked()).toBe(false);
  const log = existsSync(ghLog) ? readFileSync(ghLog, "utf8") : "";
  expect(log.trim()).toBe("");
  expectQuietNotify(r.notify, "not-member");
});

test("routine quiet: no-ready → gate 0, no host, notify quiet", async () => {
  const r = await runRoutine({
    payload: join(FIX, "push-ok.json"),
    stub: "empty",
    tick: false,
  });
  expect(r.gate.code).toBe(0);
  expect(trimNL(r.gate.stdout)).toBe("");
  expect(r.tick).toBeNull();
  expect(hostInvoked()).toBe(false);
  expectQuietNotify(r.notify, "no-ready");
});

test("routine start-pilot: gate 10 `repo sha pilot` → tick /loop + PILOT_VERDICT → cleanup factory/<tick-id>", async () => {
  const sha = await makeProduct(product, "none");
  const payload = writePush("acme/app", sha);
  const r = await runRoutine({ payload, stub: "pilot" });
  expect(r.gate.code, r.gate.stderr).toBe(10);
  expect(trimNL(r.gate.stdout)).toBe(`acme/app ${sha} pilot`);
  expect(r.tick, "tick must run after start").not.toBeNull();
  expect(r.tick!.code, r.tick!.stderr).toBe(0);
  const host = readFileSync(hostLog, "utf8");
  expect(host).toContain("/loop");
  expect(host).toContain("/flow-next:pilot");
  expect(host).not.toMatch(/start --force/);
  const logs = existsSync(join(wt, "logs"))
    ? readdirSync(join(wt, "logs")).filter((f) => f.endsWith(".jsonl"))
    : [];
  expect(logs.length).toBeGreaterThanOrEqual(1);
  const logText = logs.map((f) => readFileSync(join(wt, "logs", f), "utf8")).join("");
  expect(logText).toContain('"phase":');
  expect(logText).toContain('"kind":"pilot"');
  expect(logText).toMatch(/PILOT_VERDICT|NO_WORK|"verdict":"NO_WORK"/);
  const mirrors = existsSync(join(wt, "mirrors")) ? readdirSync(join(wt, "mirrors")) : [];
  expect(mirrors.length).toBeGreaterThan(0);
  for (const m of mirrors) {
    const listed = await runCmd([
      "git",
      `--git-dir=${join(wt, "mirrors", m)}`,
      "branch",
      "--list",
      "factory/*",
    ]);
    expect(trimNL(listed.stdout), listed.stdout).toBe("");
  }
  const ticks = existsSync(join(wt, "ticks")) ? readdirSync(join(wt, "ticks")) : [];
  expect(ticks.length).toBe(0);
  expectQuietNotify(r.notify, "start-pilot");
});

test("routine start-land: gate 10 `repo sha land` → tick /flow-next:land", async () => {
  const sha = await makeProduct(product, "none");
  const payload = writePush("acme/app", sha);
  const r = await runRoutine({ payload, stub: "land" });
  expect(r.gate.code, r.gate.stderr).toBe(10);
  expect(trimNL(r.gate.stdout)).toBe(`acme/app ${sha} land`);
  expect(r.tick).not.toBeNull();
  expect(r.tick!.code, r.tick!.stderr).toBe(0);
  expect(readFileSync(hostLog, "utf8")).toContain("/flow-next:land");
  expectQuietNotify(r.notify, "start-land");
});

test("routine stuck: contents 403 → gate 20, no host, notify NEEDS_HUMAN", async () => {
  const r = await runRoutine({
    payload: join(FIX, "push-ok.json"),
    stub: "membership_403",
    tick: false,
  });
  expect(r.gate.code).toBe(20);
  expect(r.gate.stderr).toMatch(/403/);
  expect(r.tick).toBeNull();
  expect(hostInvoked()).toBe(false);
  expectNeedsHuman(r.notify, "403");
  expect(r.notify.stdout).toContain("403");
});

test("routine stuck: malformed sidecar → gate 20, notify NEEDS_HUMAN", async () => {
  const r = await runRoutine({
    payload: join(FIX, "push-ok.json"),
    stub: "malformed",
    tick: false,
  });
  expect(r.gate.code).toBe(20);
  expect(r.gate.stderr.trim().length).toBeGreaterThan(0);
  expect(r.tick).toBeNull();
  expect(hostInvoked()).toBe(false);
  expectNeedsHuman(r.notify, "malformed sidecar");
});

test("routine stuck: unfulfillable pin (bogus backend) → tick 20, notify NEEDS_HUMAN", async () => {
  const sha = await makeProduct(product, "bogus");
  const payload = writePush("acme/app", sha);
  const r = await runRoutine({ payload, stub: "pilot" });
  expect(r.gate.code).toBe(10);
  expect(r.tick).not.toBeNull();
  expect(r.tick!.code).toBe(20);
  expect(r.tick!.stderr.toLowerCase()).toContain("pin");
  expectNeedsHuman(r.notify, "unfulfillable pin");
  expect(r.notify.stdout.toLowerCase()).toContain("pin");
});

test("routine stuck: empty pin `codex:` → tick 20 not start, notify NEEDS_HUMAN", async () => {
  writeFileSync(join(bin, "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  const sha = await makeProduct(product, "codex:");
  const payload = writePush("acme/app", sha);
  const r = await runRoutine({ payload, stub: "pilot" });
  expect(r.gate.code).toBe(10);
  expect(r.tick).not.toBeNull();
  expect(r.tick!.code).toBe(20);
  expect(r.tick!.stderr.toLowerCase()).toContain("pin");
  expect(hostStarted()).toBe(false);
  expectNeedsHuman(r.notify, "empty pin codex:");
});

test("routine stuck: reviewer: bogus → tick 20 not start, notify NEEDS_HUMAN", async () => {
  const sha = await makeProduct(product, "none", false);
  writeFileSync(
    join(product, "CLAUDE.md"),
    `<!-- flow-next:model-routing:start -->
<!-- reviewer: bogus -->
<!-- flow-next:model-routing:end -->
`,
  );
  await runCmd(["git", "-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await runCmd([
    "git",
    "-C",
    product,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-qm",
    "bogus-route",
  ]);
  const head = trimNL((await runCmd(["git", "-C", product, "rev-parse", "HEAD"])).stdout);
  const payload = writePush("acme/app", head);
  const r = await runRoutine({ payload, stub: "pilot" });
  expect(r.gate.code).toBe(10);
  expect(r.tick).not.toBeNull();
  expect(r.tick!.code).toBe(20);
  expect(hostStarted()).toBe(false);
  expectNeedsHuman(r.notify, "reviewer: bogus");
});

test("routine unexpected nonzero 1 → notify NEEDS_HUMAN not quiet", async () => {
  const n = await runNotify(1, "process crashed");
  expectNeedsHuman(n, "exit 1");
});

test("routine unexpected nonzero 137 → notify NEEDS_HUMAN not quiet", async () => {
  const n = await runNotify(137, "killed");
  expectNeedsHuman(n, "exit 137");
});

test("routine host exit 1 → tick 20 → notify NEEDS_HUMAN", async () => {
  const sha = await makeProduct(product, "none");
  const payload = writePush("acme/app", sha);
  const r = await runRoutine({
    payload,
    stub: "pilot",
    tickExtra: { FACTORY_HOST_EXIT: "1" },
  });
  expect(r.gate.code).toBe(10);
  expect(r.tick).not.toBeNull();
  expect(r.tick!.code).toBe(20);
  expect(r.tick!.stderr).toMatch(/host exited 1/);
  expectNeedsHuman(r.notify, "host exit 1");
});

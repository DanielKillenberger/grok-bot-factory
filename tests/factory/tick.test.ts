import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { repoKey } from "../../factory/lib/worktree.ts";
import {
  BUN,
  ROOT,
  STUB_HOST,
  TICK,
  cleanEnv,
  factorySources,
  git,
  linkStub,
  makeBin,
  makeProduct,
  runBun,
  runCmd,
  tempDir,
  trimNL,
} from "./helpers.ts";

let tmp = "";
let bin = "";
let path = "";
let wt = "";
let product = "";
let sha = "";
let hostLog = "";
let pwdLog = "";
let cloudLog = "";

function baseEnv(extra: Record<string, string | undefined> = {}) {
  return {
    PATH: path,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    FACTORY_HOST_LOG: hostLog,
    FACTORY_HOST_PWD_LOG: pwdLog,
    FACTORY_CLOUD_LOG: cloudLog,
    FACTORY_HOST_HELP: "loop",
    FACTORY_HOST_VERDICT: "NO_WORK",
    FACTORY_HOST: undefined,
    FACTORY_CLONE_URL: undefined,
    FACTORY_WORKTREE_ROOT: undefined,
    FACTORY_HOST_HOLD: undefined,
    FACTORY_HOST_SLEEP: undefined,
    FACTORY_HOST_EXIT: undefined,
    FACTORY_HOST_MUTATE: undefined,
    ...extra,
  };
}

function freshHost() {
  writeFileSync(hostLog, "");
  writeFileSync(pwdLog, "");
  writeFileSync(cloudLog, "");
}

beforeEach(async () => {
  tmp = tempDir();
  const made = makeBin(tmp);
  bin = made.bin;
  path = made.path;
  wt = join(tmp, "wt");
  mkdirSync(wt, { recursive: true });
  linkStub(bin, "grok", STUB_HOST);
  hostLog = join(tmp, "host.log");
  pwdLog = join(tmp, "host.pwd");
  cloudLog = join(tmp, "cloud.log");
  freshHost();
  product = join(tmp, "product");
  sha = await makeProduct(product, "none");
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function runTick(
  args: string[],
  extra: Record<string, string | undefined> = {},
) {
  return runBun(TICK, args, { env: baseEnv(extra) });
}

function tickArgs(kind = "pilot"): string[] {
  return [
    "--host",
    join(bin, "grok"),
    "--worktree-root",
    wt,
    "--clone-url",
    product,
    "acme/app",
    sha,
    kind,
  ];
}

test("missing host CLI", async () => {
  const empty = join(tmp, "empty-path");
  mkdirSync(empty, { recursive: true });
  const res = await runTick(
    ["--worktree-root", wt, "--clone-url", product, "acme/app", sha, "pilot"],
    { PATH: `${empty}:/usr/bin:/bin` },
  );
  expect(res.code).toBe(20);
  expect(res.stderr.trim().length).toBeGreaterThan(0);
});

test("host without /loop or /goal", async () => {
  const res = await runTick(tickArgs(), { FACTORY_HOST_HELP: "none" });
  expect(res.code).toBe(20);
});

test("unfulfillable review pin (unknown backend)", async () => {
  sha = await makeProduct(product, "bogus");
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("unfulfillable review pin (host + grok writer)", async () => {
  sha = await makeProduct(product, "host");
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("unfulfillable review pin (cursor effort)", async () => {
  sha = await makeProduct(product, "cursor:gpt-5.6-sol-high:high");
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("unfulfillable review pin (bare cursor)", async () => {
  sha = await makeProduct(product, "cursor");
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("unfulfillable review pin (malformed backend type)", async () => {
  writeFileSync(join(product, ".flow/config.json"), JSON.stringify({ review: { backend: 12 } }));
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "bad-pin"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
  expect(res.stderr.toLowerCase()).toContain("pin");
});

test("malformed routing block is stuck", async () => {
  writeFileSync(
    join(product, "CLAUDE.md"),
    "<!-- flow-next:model-routing:start -->\nno end\n",
  );
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "bad-route"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
  expect(res.stderr.toLowerCase()).toMatch(/routing|pin/);
});

test("empty pin segment codex: is stuck even if codex is on PATH", async () => {
  writeFileSync(join(bin, "codex"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  sha = await makeProduct(product, "codex:");
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
  expect(res.stderr.toLowerCase()).toContain("pin");
});

test("invalid routing assignment is stuck", async () => {
  writeFileSync(
    join(product, "CLAUDE.md"),
    `<!-- flow-next:model-routing:start -->
<!-- reviewer: bogus -->
<!-- flow-next:model-routing:end -->
`,
  );
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "bogus-route"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("routing block with no assignment is stuck", async () => {
  writeFileSync(
    join(product, "CLAUDE.md"),
    `<!-- flow-next:model-routing:start -->
<!-- flow-next:model-routing:end -->
`,
  );
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "empty-route"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("invalid AGENTS.md routing is stuck even when CLAUDE.md is valid", async () => {
  writeFileSync(
    join(product, "AGENTS.md"),
    `<!-- flow-next:model-routing:start -->
<!-- reviewer: bogus -->
<!-- flow-next:model-routing:end -->
`,
  );
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "agents-bogus"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const res = await runTick(tickArgs());
  expect(res.code).toBe(20);
});

test("both CLAUDE.md and AGENTS.md routing blocks are preserved", async () => {
  writeFileSync(
    join(product, "CLAUDE.md"),
    `<!-- flow-next:model-routing:start -->
<!-- reviewer: none -->
<!-- flow-next:model-routing:end -->
`,
  );
  writeFileSync(
    join(product, "AGENTS.md"),
    `<!-- flow-next:model-routing:start -->
<!-- backend: none -->
<!-- flow-next:model-routing:end -->
`,
  );
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "both-route"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  const claudeBefore = readFileSync(join(product, "CLAUDE.md"), "utf8");
  const agentsBefore = readFileSync(join(product, "AGENTS.md"), "utf8");
  const res = await runTick(tickArgs());
  expect(res.code, res.stderr).toBe(0);
  expect(readFileSync(join(product, "CLAUDE.md"), "utf8")).toBe(claudeBefore);
  expect(readFileSync(join(product, "AGENTS.md"), "utf8")).toBe(agentsBefore);
});

test("pilot tick NO_WORK", async () => {
  const pinBefore = readFileSync(join(product, ".flow/config.json"), "utf8");
  const routingBefore = readFileSync(join(product, "CLAUDE.md"), "utf8");
  const res = await runTick(tickArgs());
  expect(res.code, res.stderr).toBe(0);
  expect(res.stdout).not.toMatch(/picked up|still running|PR opened|progress ping/);
  const host = readFileSync(hostLog, "utf8");
  expect(host).toContain("/loop");
  expect(host).toContain("/flow-next:pilot");
  expect(host).not.toMatch(/start --force/);
  const logs = readdirSync(join(wt, "logs")).filter((f) => f.endsWith(".jsonl"));
  expect(logs.length).toBeGreaterThanOrEqual(1);
  const logText = logs.map((f) => readFileSync(join(wt, "logs", f), "utf8")).join("");
  expect(logText).toContain('"phase":');
  expect(logText).toContain('"repo":"acme/app"');
  expect(logText).toContain('"kind":"pilot"');
  expect(readFileSync(join(product, ".flow/config.json"), "utf8")).toBe(pinBefore);
  expect(readFileSync(join(product, "CLAUDE.md"), "utf8")).toBe(routingBefore);
});

test("no leftover factory/<tick-id> branches", async () => {
  const res = await runTick(tickArgs());
  expect(res.code, res.stderr).toBe(0);
  const mirrors = readdirSync(join(wt, "mirrors"));
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
});

test("land invokes /flow-next:land", async () => {
  const res = await runTick(tickArgs("land"));
  expect(res.code).toBe(0);
  expect(readFileSync(hostLog, "utf8")).toContain("/flow-next:land");
});

test("cursor pin still uses instance host", async () => {
  writeFileSync(
    join(bin, "cursor-agent"),
    `#!/bin/sh\nprintf '%s\\n' "cursor-agent $*" >>"${cloudLog}"\nexit 99\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "cloud-agent"),
    `#!/bin/sh\nprintf '%s\\n' "cloud-agent $*" >>"${cloudLog}"\nexit 99\n`,
    { mode: 0o755 },
  );
  sha = await makeProduct(product, "cursor:gpt-5.6-sol-high");
  const res = await runTick(tickArgs());
  expect(res.code, res.stderr).toBe(0);
  expect(readFileSync(hostLog, "utf8")).not.toContain("cursor-agent");
  const cloud = existsSync(cloudLog) ? readFileSync(cloudLog, "utf8") : "";
  expect(cloud.trim()).toBe("");
});

test("config.json host key ignored", async () => {
  const cfg = JSON.parse(readFileSync(join(product, ".flow/config.json"), "utf8"));
  cfg.host = "/tmp/from-config-host";
  writeFileSync(join(product, ".flow/config.json"), JSON.stringify(cfg));
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A"]);
  await git(["-C", product, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "config host trap"]);
  sha = trimNL((await git(["-C", product, "rev-parse", "HEAD"])).stdout);
  mkdirSync(join(tmp, "from-config"), { recursive: true });
  writeFileSync(
    join(tmp, "from-config-host"),
    `#!/bin/sh\necho from-config >>"${cloudLog}"\n`,
    { mode: 0o755 },
  );
  const res = await runTick(tickArgs());
  expect(res.code).toBe(0);
  const cloud = existsSync(cloudLog) ? readFileSync(cloudLog, "utf8") : "";
  expect(cloud).not.toContain("from-config");
});

test("two overlapping starts get two worktrees", async () => {
  const hold = join(tmp, "hold");
  mkdirSync(hold, { recursive: true });
  rmSync(wt, { recursive: true, force: true });
  mkdirSync(wt, { recursive: true });
  const env = baseEnv({ FACTORY_HOST_HOLD: hold });
  const proc1 = Bun.spawn([BUN, TICK, ...tickArgs()], {
    env: cleanEnv(env),
    stdout: "pipe",
    stderr: "pipe",
  });
  const proc2 = Bun.spawn([BUN, TICK, ...tickArgs()], {
    env: cleanEnv(env),
    stdout: "pipe",
    stderr: "pipe",
  });
  let pwds: string[] = [];
  for (let i = 0; i < 40; i++) {
    const files = existsSync(hold)
      ? readdirSync(hold).filter((f) => f.startsWith("pwd."))
      : [];
    if (files.length >= 2) {
      pwds = [...new Set(files.map((f) => trimNL(readFileSync(join(hold, f), "utf8"))))];
      if (pwds.length >= 2) break;
    }
    await Bun.sleep(100);
  }
  writeFileSync(join(hold, "release"), "1");
  const rc1 = await proc1.exited;
  const rc2 = await proc2.exited;
  expect(rc1).toBe(0);
  expect(rc2).toBe(0);
  expect(pwds.length).toBe(2);
  expect(pwds[0]).not.toBe(pwds[1]);
}, 20_000);

test("cleanup does not remove another tick's tree", async () => {
  const hold = join(tmp, "hold2");
  mkdirSync(hold, { recursive: true });
  rmSync(wt, { recursive: true, force: true });
  mkdirSync(wt, { recursive: true });
  const heldEnv = baseEnv({ FACTORY_HOST_HOLD: hold });
  const held = Bun.spawn([BUN, TICK, ...tickArgs()], {
    env: cleanEnv(heldEnv),
    stdout: "pipe",
    stderr: "pipe",
  });
  let heldPwd = "";
  for (let i = 0; i < 40; i++) {
    const files = existsSync(hold)
      ? readdirSync(hold).filter((f) => f.startsWith("pwd."))
      : [];
    if (files.length > 0) {
      heldPwd = trimNL(readFileSync(join(hold, files[0]), "utf8"));
      break;
    }
    await Bun.sleep(100);
  }
  const res = await runTick(tickArgs());
  expect(res.code).toBe(0);
  expect(heldPwd.length).toBeGreaterThan(0);
  expect(existsSync(heldPwd)).toBe(true);
  writeFileSync(join(hold, "release"), "1");
  await held.exited;
}, 20_000);

test("symlink-escape ticks refused", async () => {
  const esc = join(tmp, "escape-root");
  const evil = join(tmp, "evil");
  mkdirSync(esc, { recursive: true });
  mkdirSync(evil, { recursive: true });
  symlinkSync(evil, join(esc, "ticks"));
  const res = await runTick([
    "--host",
    join(bin, "grok"),
    "--worktree-root",
    esc,
    "--clone-url",
    product,
    "acme/app",
    sha,
    "pilot",
  ]);
  expect(res.code).toBe(20);
  const extra = readdirSync(evil);
  expect(extra.length).toBe(0);
});

test("no eval / force-push / git config edits / Cloud Agents / live hook", async () => {
  for (const f of factorySources()) {
    const text = readFileSync(f, "utf8");
    expect(text, f).not.toMatch(/(^|[^A-Za-z0-9_])eval[\s(]/);
    expect(text, f).not.toMatch(/push\s+--force|git\s+push\s+-f/);
    expect(text, f).not.toMatch(/git\s+config\s/);
    expect(text, f).not.toMatch(/start\s+--force/);
    expect(text, f).not.toMatch(/cloud-agent|CloudAgent/);
    expect(text, f).not.toMatch(/api\.github.com\/repos\/.*\/hooks|hooks\.github/);
  }
});

test("default host from PATH", async () => {
  const res = await runTick(
    ["--worktree-root", wt, "--clone-url", product, "acme/app", sha, "pilot"],
    { PATH: `${bin}:/usr/bin:/bin`, FACTORY_HOST: undefined },
  );
  expect(res.code, res.stderr).toBe(0);
  expect(readFileSync(hostLog, "utf8")).toContain("/loop");
});

test("repo keys are injective", () => {
  const k1 = repoKey("a/b__c");
  const k2 = repoKey("a__b/c");
  expect(k1.length).toBeGreaterThan(0);
  expect(k1).not.toBe(k2);
});

test("symlink-escape logs refused", async () => {
  const esc = join(tmp, "escape-logs");
  const evil = join(tmp, "evil-logs");
  mkdirSync(esc, { recursive: true });
  mkdirSync(evil, { recursive: true });
  symlinkSync(evil, join(esc, "logs"));
  const res = await runTick([
    "--host",
    join(bin, "grok"),
    "--worktree-root",
    esc,
    "--clone-url",
    product,
    "acme/app",
    sha,
    "pilot",
  ]);
  expect(res.code).toBe(20);
});

test("host nonzero is stuck", async () => {
  const res = await runTick(tickArgs(), { FACTORY_HOST_EXIT: "1" });
  expect(res.code).toBe(20);
});

test("deleted review pin is stuck", async () => {
  const res = await runTick(tickArgs(), { FACTORY_HOST_MUTATE: "delete-pin" });
  expect(res.code).toBe(20);
});

test("unrelated config edit keeps pin", async () => {
  const res = await runTick(tickArgs(), { FACTORY_HOST_MUTATE: "unrelated" });
  expect(res.code, res.stderr).toBe(0);
});

test("host NEEDS_HUMAN is stuck", async () => {
  const res = await runTick(tickArgs(), { FACTORY_HOST_VERDICT: "NEEDS_HUMAN" });
  expect(res.code).toBe(20);
});

test("PILOT_VERDICT=NO_WORK with metadata fields", async () => {
  const res = await runTick(tickArgs());
  expect(res.code).toBe(0);
});

import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { whichOnPath } from "../../factory/lib/cmd.ts";
import {
  hostArgv,
  hostProbe,
  hostRun,
  hostTypescriptPath,
  reviewPinValidate,
  routingBlockRead,
  routingBlockValidate,
} from "../../factory/lib/pin.ts";
import { tempDir } from "./helpers.ts";

function expectPinError(spec: string, hostBin = "grok"): string {
  const result = reviewPinValidate(spec, hostBin);
  expect("error" in result, `${spec} should be invalid`).toBe(true);
  return "error" in result ? result.error : "";
}

function expectPinOk(spec: string, hostBin: string): void {
  const result = reviewPinValidate(spec, hostBin);
  expect(result, `${spec} should be valid`).toEqual({ ok: true });
}

test("empty pin segments fail before binary checks", () => {
  for (const spec of ["codex:", "codex::", "copilot:", "copilot::"]) {
    const err = expectPinError(spec);
    expect(err.toLowerCase()).toMatch(/empty/);
    expect(err.toLowerCase()).not.toMatch(/missing/);
  }
});

test("empty model or effort segments fail", () => {
  for (const spec of ["codex:model:", "codex::high", "copilot:model:", "copilot::high"]) {
    const err = expectPinError(spec);
    expect(err.toLowerCase()).toMatch(/empty/);
    expect(err.toLowerCase()).not.toMatch(/missing/);
  }
});

test("bare rp/host/none stay valid; extra components do not", () => {
  expectPinOk("rp", "grok");
  expectPinOk("none", "grok");
  expectPinOk("host", "/usr/bin/claude");
  expect(expectPinError("rp:x").toLowerCase()).toMatch(/bare-only/);
  expect(expectPinError("none:x").toLowerCase()).toMatch(/bare-only/);
  expect(expectPinError("host:x", "/usr/bin/claude").toLowerCase()).toMatch(/bare-only/);
  expect(expectPinError("host", "grok").toLowerCase()).toMatch(/grok/);
});

test("cursor still requires model and rejects effort", () => {
  expect(expectPinError("cursor").toLowerCase()).toMatch(/cursor:<model>|requires/);
  expect(expectPinError("cursor:gpt-5.6-sol-high:high").toLowerCase()).toMatch(/effort/);
});

test("unknown backend and too many parts still fail", () => {
  expect(expectPinError("bogus").toLowerCase()).toMatch(/unknown/);
  const tooMany = reviewPinValidate("codex:a:b:c", "grok");
  expect("error" in tooMany).toBe(true);
});

test("valid codex/copilot forms are not empty-segment errors", () => {
  for (const spec of [
    "codex",
    "codex:model",
    "codex:model:effort",
    "copilot",
    "copilot:model",
    "copilot:model:effort",
  ]) {
    const result = reviewPinValidate(spec, "grok");
    if ("error" in result) {
      expect(result.error.toLowerCase(), spec).toMatch(/missing/);
      expect(result.error.toLowerCase(), spec).not.toMatch(/empty/);
    } else {
      expect(result).toEqual({ ok: true });
    }
  }
});

test("invalid routing assignment is an error", () => {
  const block = `<!-- flow-next:model-routing:start -->
<!-- reviewer: bogus -->
<!-- flow-next:model-routing:end -->`;
  const result = routingBlockValidate(block, "grok");
  expect("error" in result).toBe(true);
});

test("backend and review.backend invalid assignments are errors", () => {
  for (const line of ["backend: bogus", "review.backend: bogus"]) {
    const block = `<!-- flow-next:model-routing:start -->
<!-- ${line} -->
<!-- flow-next:model-routing:end -->`;
    const result = routingBlockValidate(block, "grok");
    expect("error" in result, line).toBe(true);
  }
});

test("routing block with no assignment is an error", () => {
  const block = `<!-- flow-next:model-routing:start -->
<!-- flow-next:model-routing:end -->`;
  const result = routingBlockValidate(block, "grok");
  expect("error" in result).toBe(true);
});

test("empty-segment pins inside routing fail", () => {
  const block = `<!-- flow-next:model-routing:start -->
<!-- reviewer: codex: -->
<!-- flow-next:model-routing:end -->`;
  const result = routingBlockValidate(block, "grok");
  expect("error" in result).toBe(true);
  if ("error" in result) expect(result.error.toLowerCase()).toMatch(/empty|pin/);
});

test("well-formed routing assignment validates", () => {
  const block = `<!-- flow-next:model-routing:start -->
<!-- reviewer: none -->
<!-- flow-next:model-routing:end -->`;
  expect(routingBlockValidate(block, "grok")).toEqual({ ok: true });
});

let checkout = "";

beforeEach(() => {
  checkout = tempDir();
});

afterEach(() => {
  rmSync(checkout, { recursive: true, force: true });
});

function writeRouting(file: string, assignment: string): void {
  writeFileSync(
    join(checkout, file),
    `<!-- flow-next:model-routing:start -->
<!-- ${assignment} -->
<!-- flow-next:model-routing:end -->
`,
  );
}

test("routingBlockRead returns every applicable block", () => {
  writeRouting("CLAUDE.md", "reviewer: none");
  writeRouting("AGENTS.md", "backend: none");
  const result = routingBlockRead(checkout);
  expect("error" in result).toBe(false);
  if ("error" in result) return;
  expect(result.blocks.length).toBe(2);
  expect(result.blocks[0].file).toBe(join(checkout, "CLAUDE.md"));
  expect(result.blocks[1].file).toBe(join(checkout, "AGENTS.md"));
  expect(result.blocks[0].block).toContain("reviewer: none");
  expect(result.blocks[1].block).toContain("backend: none");
});

test("routingBlockRead inspects AGENTS.md even when CLAUDE.md is valid", () => {
  writeRouting("CLAUDE.md", "reviewer: none");
  writeFileSync(
    join(checkout, "AGENTS.md"),
    "<!-- flow-next:model-routing:start -->\nno end\n",
  );
  const result = routingBlockRead(checkout);
  expect("error" in result).toBe(true);
});

test("grok-named stub without /loop in help probes as loop", async () => {
  const grok = join(checkout, "grok");
  writeFileSync(grok, "#!/bin/sh\necho usage: grok\n", { mode: 0o755 });
  expect(await hostProbe(grok)).toEqual({ drive: "loop" });
});

test("inventory host without /loop or /goal still fails probe", async () => {
  const claude = join(checkout, "claude");
  writeFileSync(claude, "#!/bin/sh\necho usage: claude\n", { mode: 0o755 });
  const result = await hostProbe(claude);
  expect("error" in result).toBe(true);
});

test("missing host still fails probe", async () => {
  const result = await hostProbe(join(checkout, "no-such-host"));
  expect("error" in result).toBe(true);
  if ("error" in result) expect(result.error).toMatch(/missing/);
});

test("unexecutable grok still fails probe", async () => {
  const grok = join(checkout, "grok");
  writeFileSync(grok, "#!/bin/sh\necho usage: grok\n", { mode: 0o644 });
  const result = await hostProbe(grok);
  expect("error" in result).toBe(true);
  if ("error" in result) expect(result.error).toMatch(/missing/);
});

function writeArgvHost(path: string, argvLog: string): void {
  writeFileSync(
    path,
    `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(argvLog)}, JSON.stringify(process.argv.slice(2)) + "\\n");
process.exit(0);
`,
    { mode: 0o755 },
  );
}

function expectOkRun(
  ran: { code: number; stdout: string; stderr: string } | { error: string },
): { code: number; stdout: string; stderr: string } {
  expect("error" in ran, "error" in ran ? ran.error : "").toBe(false);
  if ("error" in ran) throw new Error(ran.error);
  return ran;
}

function expectGrokScriptArgv(
  host: string,
  drive: "loop" | "goal",
  skill: string,
  typescript: string,
): string[] {
  const built = hostArgv(host, drive, skill, typescript);
  expect(Array.isArray(built), Array.isArray(built) ? "" : built.error).toBe(true);
  if (!Array.isArray(built)) throw new Error(built.error);
  const scriptBin = whichOnPath("script");
  expect(scriptBin).toBeTruthy();
  const prompt = drive === "loop" ? `/loop 10m ${skill}` : `/goal ${skill}`;
  expect(built).toEqual([
    scriptBin as string,
    "-q",
    "-e",
    "-f",
    "-c",
    `'${host}' --always-approve --no-alt-screen '${prompt}'`,
    typescript,
  ]);
  return built;
}

function makeTree(): string {
  const tree = join(checkout, "tree");
  mkdirSync(tree, { recursive: true });
  return tree;
}

test("hostRun grok loop is script PTY + one prompt", async () => {
  const grok = join(checkout, "grok");
  const tree = makeTree();
  const argvLog = join(checkout, "argv.jsonl");
  writeArgvHost(grok, argvLog);
  expectGrokScriptArgv(grok, "loop", "/flow-next:pilot", hostTypescriptPath(tree));
  const ran = expectOkRun(await hostRun(grok, "loop", "pilot", tree));
  expect(ran.code).toBe(0);
  const argv = JSON.parse(readFileSync(argvLog, "utf8").trim()) as string[];
  expect(argv).toEqual(["--always-approve", "--no-alt-screen", "/loop 10m /flow-next:pilot"]);
  expect(argv.join(" ")).toContain("/loop");
  expect(existsSync(hostTypescriptPath(tree))).toBe(true);
});

test("hostRun grok goal is script PTY + one prompt", async () => {
  const grok = join(checkout, "grok");
  const tree = makeTree();
  const argvLog = join(checkout, "argv.jsonl");
  writeArgvHost(grok, argvLog);
  expectGrokScriptArgv(grok, "goal", "/flow-next:land", hostTypescriptPath(tree));
  const ran = expectOkRun(await hostRun(grok, "goal", "land", tree));
  expect(ran.code).toBe(0);
  expect(JSON.parse(readFileSync(argvLog, "utf8").trim())).toEqual([
    "--always-approve",
    "--no-alt-screen",
    "/goal /flow-next:land",
  ]);
  expect(existsSync(hostTypescriptPath(tree))).toBe(true);
});

test("hostRun generic inventory host keeps split argv", async () => {
  const claude = join(checkout, "claude");
  const tree = makeTree();
  const argvLog = join(checkout, "argv.jsonl");
  writeArgvHost(claude, argvLog);
  expect(hostArgv(claude, "loop", "/flow-next:pilot")).toEqual([
    claude,
    "/loop",
    "10m",
    "/flow-next:pilot",
  ]);
  const ran = expectOkRun(await hostRun(claude, "loop", "pilot", tree));
  expect(ran.code).toBe(0);
  expect(JSON.parse(readFileSync(argvLog, "utf8").trim())).toEqual([
    "/loop",
    "10m",
    "/flow-next:pilot",
  ]);
  expect(existsSync(hostTypescriptPath(tree))).toBe(false);
});

test("hostRun stops a hanging grok after the first PILOT_VERDICT line", async () => {
  const tree = makeTree();
  const grok = join(checkout, "grok");
  const marker = join(checkout, "hanging.pid");
  writeFileSync(
    grok,
    `#!/bin/sh
echo $$ > "${marker}"
echo 'PILOT_VERDICT=NO_WORK spec=- stage=- reason="hang-stub"'
sleep 120
`,
    { mode: 0o755 },
  );
  const prevTimeout = process.env.FACTORY_HOST_TIMEOUT_MS;
  process.env.FACTORY_HOST_TIMEOUT_MS = "8000";
  const t0 = Date.now();
  try {
    const ran = expectOkRun(await hostRun(grok, "loop", "pilot", tree));
    expect(Date.now() - t0).toBeLessThan(7000);
    expect(ran.code).toBe(0);
    const line = ran.stdout.split(/\r?\n/).find((l) => l.startsWith("PILOT_VERDICT="));
    expect(line).toBe('PILOT_VERDICT=NO_WORK spec=- stage=- reason="hang-stub"');
    await Bun.sleep(150);
    expect(existsSync(marker)).toBe(true);
    const pid = Number(readFileSync(marker, "utf8").trim());
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    if (prevTimeout === undefined) delete process.env.FACTORY_HOST_TIMEOUT_MS;
    else process.env.FACTORY_HOST_TIMEOUT_MS = prevTimeout;
  }
}, 15_000);



test("whichOnPath does not find script on an empty PATH", () => {
  expect(whichOnPath("script", "")).toBeNull();
  expect(whichOnPath("script", "/tmp/no-such-bin")).toBeNull();
  expect(whichOnPath("script")).toMatch(/\/script$/);
});

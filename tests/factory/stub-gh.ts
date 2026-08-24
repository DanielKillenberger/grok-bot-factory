#!/usr/bin/env bun
import { basename } from "node:path";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const log = process.env.FACTORY_GH_LOG;
if (!log) {
  console.error("FACTORY_GH_LOG missing");
  process.exit(1);
}

const args = process.argv.slice(2).join(" ");
appendFileSync(log, `${args}\n`);

if (
  args.includes("repo list") ||
  args.includes("repo ls") ||
  args.includes("user/repos") ||
  args.includes("search/repositories") ||
  args.includes("/orgs/")
) {
  appendFileSync(`${log}.fleet`, `${args}\n`);
  console.error("gh: fleet-scan is forbidden on the fire path");
  process.exit(1);
}

function httpErr(code: number, msg: string): never {
  console.error(`gh: ${msg} (HTTP ${code})`);
  process.exit(1);
}

function networkErr(): never {
  console.error(
    'gh: Get "https://api.github.com/": dial tcp: lookup api.github.com: no such host',
  );
  process.exit(1);
}

function contentsFile(file: string): void {
  const name = basename(file);
  const b64 = Buffer.from(readFileSync(file)).toString("base64");
  process.stdout.write(
    JSON.stringify({
      name,
      path: `x/${name}`,
      type: "file",
      encoding: "base64",
      content: b64,
    }) + "\n",
  );
}

function dirListing(names: string[]): void {
  process.stdout.write(
    JSON.stringify(names.map((n) => ({ name: n, type: "file", path: `x/${n}` }))) + "\n",
  );
}

function pathHas(s: string): boolean {
  return args.includes(s);
}

const scenario = process.env.FACTORY_STUB;
if (!scenario) {
  console.error("FACTORY_STUB missing");
  process.exit(1);
}
const repo = process.env.FACTORY_STUB_REPO ?? "acme/app";
const fix = process.env.FACTORY_FIXTURES;
if (!fix) {
  console.error("FACTORY_FIXTURES missing");
  process.exit(1);
}

if (
  scenario === "429_then_ok" &&
  pathHas(`repos/${repo}/contents/.flow`) &&
  !pathHas("contents/.flow/")
) {
  const countFile = `${log}.429`;
  let n = 0;
  if (existsSync(countFile)) n = Number(readFileSync(countFile, "utf8"));
  n += 1;
  writeFileSync(countFile, `${n}\n`);
  if (n === 1) httpErr(429, "API rate limit exceeded");
  dirListing([]);
  process.exit(0);
}

if (scenario === "network") networkErr();
if (scenario === "membership_403") httpErr(403, "Resource not accessible by integration");
if (scenario === "membership_500") httpErr(502, "Server Error");
if (scenario === "membership_404") httpErr(404, "Not Found");
if (scenario === "membership_malformed") {
  process.stdout.write('{"type":"file","name":".flow"}\n');
  process.exit(0);
}
if (scenario === "hang") {
  await Bun.sleep(60_000);
  process.exit(0);
}

if (pathHas(`repos/${repo}/contents/.flow`) && !pathHas("contents/.flow/")) {
  switch (scenario) {
    case "empty":
    case "pilot":
    case "land":
    case "mixed":
    case "unclassifiable":
    case "unready":
    case "malformed":
    case "partial":
    case "feature":
    case "missing_specs":
    case "bad_listing":
    case "bad_task":
    case "truncated":
      dirListing([]);
      process.exit(0);
  }
}

if (pathHas(`repos/${repo}/contents/.flow/specs`) && !pathHas("contents/.flow/specs/")) {
  switch (scenario) {
    case "empty":
      process.stdout.write("[]\n");
      process.exit(0);
    case "unready":
      dirListing(["spec-unready.json", "spec-missing-ready.json"]);
      process.exit(0);
    case "pilot":
    case "feature":
      dirListing(["spec-ready-pilot.json"]);
      process.exit(0);
    case "land":
      dirListing(["spec-ready-land.json"]);
      process.exit(0);
    case "mixed":
      dirListing(["spec-ready-pilot.json", "spec-ready-land.json"]);
      process.exit(0);
    case "unclassifiable":
      dirListing(["spec-unclassifiable.json"]);
      process.exit(0);
    case "malformed":
      dirListing(["spec-malformed.json"]);
      process.exit(0);
    case "partial":
      dirListing(["spec-ready-pilot.json", "spec-ready-land.json"]);
      process.exit(0);
    case "truncated": {
      const listing = Array.from({ length: 1000 }, (_, i) => {
        const name = `n${String(i).padStart(4, "0")}`;
        return { name, type: "file", path: `x/${name}` };
      });
      process.stdout.write(JSON.stringify(listing) + "\n");
      process.exit(0);
    }
    case "missing_specs":
      httpErr(404, "Not Found");
    case "bad_listing":
      process.stdout.write('[{"name":"spec-ready-pilot.json"}]\n');
      process.exit(0);
    case "bad_task":
      process.stdout.write("[]\n");
      process.exit(0);
  }
}

if (pathHas(`repos/${repo}/contents/.flow/tasks`) && !pathHas("contents/.flow/tasks/")) {
  switch (scenario) {
    case "empty":
    case "unready":
    case "unclassifiable":
    case "malformed":
    case "bad_listing":
      process.stdout.write("[]\n");
      process.exit(0);
    case "bad_task":
      dirListing(["task-bad.json"]);
      process.exit(0);
    case "pilot":
    case "feature":
      dirListing(["task-open.json"]);
      process.exit(0);
    case "land":
      dirListing(["task-done.json"]);
      process.exit(0);
    case "mixed":
      dirListing(["task-open.json", "task-done.json"]);
      process.exit(0);
    case "partial":
      process.stdout.write("[]\n");
      process.exit(0);
  }
}

const sidecar: Record<string, string> = {
  "contents/.flow/specs/spec-ready-pilot.json": `${fix}/sidecars/spec-ready-pilot.json`,
  "contents/.flow/specs/spec-ready-land.json": `${fix}/sidecars/spec-ready-land.json`,
  "contents/.flow/specs/spec-unready.json": `${fix}/sidecars/spec-unready.json`,
  "contents/.flow/specs/spec-missing-ready.json": `${fix}/sidecars/spec-missing-ready.json`,
  "contents/.flow/specs/spec-unclassifiable.json": `${fix}/sidecars/spec-unclassifiable.json`,
  "contents/.flow/specs/spec-malformed.json": `${fix}/sidecars/spec-malformed.json`,
  "contents/.flow/tasks/task-open.json": `${fix}/sidecars/task-open.json`,
  "contents/.flow/tasks/task-done.json": `${fix}/sidecars/task-done.json`,
  "contents/.flow/tasks/task-bad.json": `${fix}/sidecars/task-bad.json`,
};

for (const [needle, file] of Object.entries(sidecar)) {
  if (pathHas(needle)) {
    if (needle.endsWith("spec-ready-land.json") && scenario === "partial") {
      httpErr(500, "Server Error");
    }
    contentsFile(file);
    process.exit(0);
  }
}

if (pathHas(`repos/${repo}/pulls`)) {
  if (scenario === "land" || scenario === "mixed") {
    process.stdout.write('[{"number":1}]\n');
    process.exit(0);
  }
  process.stdout.write("[]\n");
  process.exit(0);
}

httpErr(404, "Not Found");

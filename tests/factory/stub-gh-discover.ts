#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const log = process.env.FACTORY_GH_LOG;
if (!log) {
  console.error("FACTORY_GH_LOG missing");
  process.exit(1);
}

const args = process.argv.slice(2).join(" ");
appendFileSync(log, `${args}\n`);

if (/\bhooks\b/.test(args) || args.includes("/hooks")) {
  appendFileSync(`${log}.hooks`, `${args}\n`);
  console.error("gh: hook mutate is forbidden on the discover path");
  process.exit(1);
}
if (/\bclone\b/.test(args)) {
  console.error("gh: clone is forbidden on the discover path");
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

function limitFromArgs(): number {
  const m = args.match(/--limit(?:\s+|=)(\d+)/);
  return m ? Number(m[1]) : 30;
}

function dirListing(): void {
  process.stdout.write(JSON.stringify([{ name: "config.json", type: "file" }]) + "\n");
}

function repoList(names: string[]): void {
  const limit = limitFromArgs();
  const slice = names.slice(0, limit);
  process.stdout.write(
    JSON.stringify(slice.map((nameWithOwner) => ({ nameWithOwner }))) + "\n",
  );
}

const scenario = process.env.FACTORY_STUB;
if (!scenario) {
  console.error("FACTORY_STUB missing");
  process.exit(1);
}

const many = Array.from({ length: 35 }, (_, i) => `acme/r${String(i + 1).padStart(2, "0")}`);
const okNames = ["acme/app", "acme/lib", "acme/bare"];

if (args.includes("repo list")) {
  if (scenario === "list_401") httpErr(401, "Bad credentials");
  if (scenario === "list_403") httpErr(403, "Resource not accessible by integration");
  if (scenario === "list_429") {
    const countFile = `${log}.429`;
    let n = 0;
    if (existsSync(countFile)) n = Number(readFileSync(countFile, "utf8"));
    n += 1;
    writeFileSync(countFile, `${n}\n`);
    httpErr(429, "API rate limit exceeded");
  }
  if (scenario === "list_500") httpErr(502, "Server Error");
  if (scenario === "network") networkErr();
  if (scenario === "list_malformed") {
    process.stdout.write("{not-json\n");
    process.exit(0);
  }
  if (scenario === "many") {
    repoList(many);
    process.exit(0);
  }
  repoList(okNames);
  process.exit(0);
}

const contents = args.match(/repos\/([^/]+\/[^/]+)\/contents\/\.flow/);
if (contents) {
  const repo = contents[1];
  if (scenario === "network") networkErr();
  if (scenario === "probe_401") httpErr(401, "Bad credentials");
  if (scenario === "probe_403") httpErr(403, "Resource not accessible by integration");
  if (scenario === "probe_429") {
    const countFile = `${log}.429`;
    let n = 0;
    if (existsSync(countFile)) n = Number(readFileSync(countFile, "utf8"));
    n += 1;
    writeFileSync(countFile, `${n}\n`);
    httpErr(429, "API rate limit exceeded");
  }
  if (scenario === "probe_500") httpErr(502, "Server Error");
  if (scenario === "malformed") {
    process.stdout.write('{"type":"file","name":".flow"}\n');
    process.exit(0);
  }
  if (scenario === "mid_scan" && repo === "acme/lib") httpErr(500, "Server Error");
  if (scenario === "many") {
    dirListing();
    process.exit(0);
  }
  if (repo === "acme/bare" || repo === "acme/named") {
    httpErr(404, "Not Found");
  }
  if (repo === "acme/app" || repo === "acme/lib" || repo.startsWith("acme/r")) {
    dirListing();
    process.exit(0);
  }
  httpErr(404, "Not Found");
}

httpErr(404, "Not Found");

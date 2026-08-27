#!/usr/bin/env bun
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const log = process.env.FACTORY_GH_LOG;
if (!log) {
  console.error("FACTORY_GH_LOG missing");
  process.exit(1);
}

const args = process.argv.slice(2).join(" ");
appendFileSync(log, `${args}\n`);

if (/\bhooks\b/.test(args) || args.includes("/hooks")) {
  appendFileSync(`${log}.hooks`, `${args}\n`);
  console.error("gh: Settings hook REST is forbidden");
  process.exit(1);
}
if (/\bclone\b/.test(args)) {
  console.error("gh: clone is forbidden");
  process.exit(1);
}

function httpErr(code: number, msg: string): never {
  console.error(`gh: ${msg} (HTTP ${code})`);
  process.exit(1);
}

const scenario = process.env.FACTORY_STUB;
if (!scenario) {
  console.error("FACTORY_STUB missing");
  process.exit(1);
}

function templateText(): string {
  const p = process.env.FACTORY_TEMPLATE_FILE ?? join(process.cwd(), ".github/workflows/factory-forward.yml");
  return readFileSync(p, "utf8");
}

function writeBody(): void {
  const idx = args.indexOf("content=");
  appendFileSync(`${log}.body`, `${args}\n`);
}

if (args.includes("secret set") || args.includes("actions/secrets")) {
  appendFileSync(`${log}.secrets`, `${args}\n`);
  if (scenario === "secret_fail") httpErr(403, "Resource not accessible by integration");
  process.exit(0);
}

const contents = args.match(/repos\/([^/]+\/[^/]+)\/contents\/\.github\/workflows\/factory-forward\.yml/);
if (contents) {
  const repo = contents[1];
  writeBody();
  if (scenario === "get_403" && args.includes("--method GET")) {
    httpErr(403, "Resource not accessible by integration");
  }
  if (scenario === "get_500" && args.includes("--method GET")) {
    httpErr(502, "Server Error");
  }
  if (args.includes("--method PUT")) {
    appendFileSync(`${log}.put`, `${args}\n`);
    if (scenario === "put_409") {
      const countFile = `${log}.409`;
      let n = 0;
      if (existsSync(countFile)) n = Number(readFileSync(countFile, "utf8"));
      n += 1;
      writeFileSync(countFile, `${n}\n`);
      if (n === 1) httpErr(409, "Conflict");
    }
    if (scenario === "put_fail") httpErr(500, "Server Error");
    process.stdout.write(JSON.stringify({ content: { path: ".github/workflows/factory-forward.yml" } }) + "\n");
    process.exit(0);
  }
  if (args.includes("--method GET") || !args.includes("--method")) {
    if (scenario === "missing" || scenario === "ok" || scenario === "secret_fail" || scenario === "put_fail") {
      httpErr(404, "Not Found");
    }
    if (scenario === "same") {
      const text = templateText();
      process.stdout.write(
        JSON.stringify({
          sha: "samesha",
          encoding: "base64",
          content: Buffer.from(text).toString("base64"),
        }) + "\n",
      );
      process.exit(0);
    }
    if (scenario === "stale" || scenario === "put_409") {
      process.stdout.write(
        JSON.stringify({
          sha: existsSync(`${log}.409`) ? "newsha" : "oldsha",
          encoding: "base64",
          content: Buffer.from("stale workflow\n").toString("base64"),
        }) + "\n",
      );
      process.exit(0);
    }
    if (repo === "acme/lib" && scenario === "partial") {
      httpErr(403, "Resource not accessible by integration");
    }
    httpErr(404, "Not Found");
  }
}

httpErr(404, "Not Found");

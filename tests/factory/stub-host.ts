#!/usr/bin/env bun
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);

if (process.env.FACTORY_HOST_LOG) {
  appendFileSync(process.env.FACTORY_HOST_LOG, `${argv.join(" ")}\n`);
}
if (process.env.FACTORY_HOST_PWD_LOG) {
  appendFileSync(process.env.FACTORY_HOST_PWD_LOG, `${process.cwd()}\n`);
}

if (argv[0] === "--help") {
  switch (process.env.FACTORY_HOST_HELP ?? "loop") {
    case "none":
      process.stdout.write("usage: grok\n");
      break;
    case "goal":
      process.stdout.write("/goal\n");
      break;
    default:
      process.stdout.write("/loop\n/goal\n");
  }
  process.exit(0);
}

if (process.env.FACTORY_HOST_SLEEP) {
  await Bun.sleep(Number(process.env.FACTORY_HOST_SLEEP) * 1000);
}

const hold = process.env.FACTORY_HOST_HOLD;
if (hold) {
  mkdirSync(hold, { recursive: true });
  writeFileSync(join(hold, `pwd.${process.pid}`), `${process.cwd()}\n`);
  while (!existsSync(join(hold, "release"))) {
    await Bun.sleep(50);
  }
}

switch (process.env.FACTORY_HOST_MUTATE) {
  case "delete-pin":
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(".flow/config.json");
    } catch {
      // ignore
    }
    break;
  case "unrelated":
    if (existsSync(".flow/config.json")) {
      const cfg = JSON.parse(readFileSync(".flow/config.json", "utf8")) as Record<
        string,
        unknown
      >;
      const land = (cfg.land as Record<string, unknown> | undefined) ?? {};
      land.patienceMinutes = 99;
      cfg.land = land;
      writeFileSync(".flow/config.json", JSON.stringify(cfg));
    }
    break;
}

const verdict = process.env.FACTORY_HOST_VERDICT ?? "NO_WORK";
if (` ${argv.join(" ")} `.includes(" /flow-next:land ")) {
  process.stdout.write(`LAND_VERDICT=${verdict} prs=0 reason="fixture"\n`);
} else {
  process.stdout.write(
    `PILOT_VERDICT=${verdict} spec=fn-x stage=work reason="fixture"\n`,
  );
}
if (Number(process.env.FACTORY_HOST_EXIT ?? "0") !== 0) {
  process.stderr.write("also mentions NO_WORK in stderr\n");
  process.exit(Number(process.env.FACTORY_HOST_EXIT));
}
process.exit(0);

import { runCmd, which } from "./cmd.ts";

export type GhClass =
  | "ok"
  | "401"
  | "404"
  | "403"
  | "422"
  | "429"
  | "5xx"
  | "transport";

export type GhResult = {
  ok: boolean;
  class: GhClass;
  stdout: string;
  stderr: string;
};

function classFromErr(err: string): GhClass {
  if (/HTTP 429/.test(err)) return "429";
  if (/HTTP 422/.test(err)) return "422";
  if (/HTTP 404/.test(err)) return "404";
  if (/HTTP 403/.test(err)) return "403";
  if (/HTTP 401/.test(err)) return "401";
  if (/HTTP 5[0-9][0-9]/.test(err)) return "5xx";
  return "transport";
}

export async function gh(
  argv: readonly string[],
  opts: { stdin?: string } = {},
): Promise<GhResult> {
  if (!which("gh")) {
    return { ok: false, class: "transport", stdout: "", stderr: "gh missing" };
  }
  const stdin = opts.stdin
    ? new TextEncoder().encode(opts.stdin)
    : "ignore";
  let attempt = 0;
  while (true) {
    const res = await runCmd(["gh", ...argv], { stdin });
    if (res.timedOut) {
      return {
        ok: false,
        class: "transport",
        stdout: res.stdout,
        stderr: res.stderr || "gh timed out",
      };
    }
    if (res.code === 0) {
      return { ok: true, class: "ok", stdout: res.stdout, stderr: res.stderr };
    }
    const klass = classFromErr(res.stderr);
    if (klass === "429" && attempt === 0) {
      attempt = 1;
      continue;
    }
    return { ok: false, class: klass, stdout: res.stdout, stderr: res.stderr };
  }
}

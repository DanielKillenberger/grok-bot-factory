import { expect, test } from "bun:test";
import { join } from "node:path";
import { ROOT } from "./helpers.ts";

function docsHost(url: string): boolean {
  return (
    url.includes("://docs.github.com/") ||
    url.includes("://docs.x.ai/") ||
    url.includes("://flow-next.dev/") ||
    url.includes("://cli.github.com/") ||
    url.includes("://git-scm.com/")
  );
}

function scanPath(text: string): string | null {
  const patHits = text.match(
    /ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|whsec_[A-Za-z0-9+/=_-]{16,}|-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  );
  if (patHits) return patHits[0];

  const assign = text.match(
    /(ROUTINE_URL|WEBHOOK_URL|SENDER_KEY|sender_key|WEBHOOK_SECRET|API_TOKEN|GITHUB_TOKEN|GH_TOKEN|AUTH_TOKEN|ACCESS_TOKEN|BOT_TOKEN|SESSION_TOKEN|SESSION_ID|session_token|session_id|VAULT_ADDR|VAULT_TOKEN)\s*[=:]\s*[^ \t\n"$<{][^ \t\n]{11,}/i,
  );
  if (assign) return assign[0];
  const json = text.match(
    /"(sender_key|routine_url|webhook_url|webhook_secret|api_token|github_token|session_token|session_id|vault_token|vault_addr)"\s*:\s*"[^"<${][^"]{11,}"/i,
  );
  if (json) return json[0];

  const vault = text.match(
    /(^|[=: \t])(~\/\.vault\/|\/[A-Za-z0-9._/-]+\/\.vault\/|\/var\/lib\/vault\/|op:\/\/[A-Za-z0-9._-]+\/)/,
  );
  if (vault) return vault[0];
  if (/hooks\.github\.com\//.test(text)) return "hooks.github.com";
  if (/api\.github.com\/repos\/[^\s]+\/hooks/.test(text)) return "api.github.com hooks";

  const urls = text.match(/https?:\/\/[^\s"']+(webhook|routine)[^\s"']*/g) ?? [];
  for (const url of urls) {
    if (!docsHost(url)) return url;
  }
  return null;
}

function plant(body: string): string | null {
  return scanPath(body);
}

test("detects planted secrets", () => {
  const pfx = "ghp_";
  const rest = "abcdefghijklmnopqrstuvwxyz0123";
  const scheme = "https://";
  const host = "example.invalid";
  const wpath = "/webhook/abc";
  const key = "SENDER_KEY";
  const jkey = "sender_key";
  const val = "s3cr3tvalue0123456789abcd";
  const sk = "session_token";
  const tk = "API_TOKEN";
  const vk = "VAULT_ADDR";
  const vpHome = "/home/user";
  const vpRest = ".vault/secrets/github";

  expect(plant(`token=${pfx}${rest}`)).not.toBeNull();
  expect(plant(`ROUTINE_URL=${scheme}${host}${wpath}`)).not.toBeNull();
  expect(plant(`${scheme}${host}${wpath}`)).not.toBeNull();
  expect(plant(`${key}=${val}`)).not.toBeNull();
  expect(plant(`"${jkey}": "${val}"`)).not.toBeNull();
  expect(plant(`${jkey}: ${val}`)).not.toBeNull();
  expect(plant(`${tk}=${val}`)).not.toBeNull();
  expect(plant(`${sk}=${val}`)).not.toBeNull();
  expect(plant(`file=${vpHome}/${vpRest}`)).not.toBeNull();
  expect(plant(`${vk}=${scheme}vault.${host}`)).not.toBeNull();
});

test("docs category names are not secrets", () => {
  expect(
    scanPath("Routine URL, sender key, tokens, PATs, sessions, and vault paths."),
  ).toBeNull();
  expect(
    scanPath("Payload URL = the routine URL\nSecret = the sender key from the panel"),
  ).toBeNull();
  expect(
    scanPath("https://docs.github.com/en/webhooks/webhook-events-and-payloads#push"),
  ).toBeNull();
  expect(
    scanPath("https://docs.x.ai/grok-bot/skills-routines-and-automations"),
  ).toBeNull();
});

test("no secrets, routine URL, sender key, or vault paths in git", async () => {
  const proc = Bun.spawn(["git", "ls-files"], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const listed = await new Response(proc.stdout).text();
  await proc.exited;
  const files = listed
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const f of files) {
    const file = Bun.file(join(ROOT, f));
    if (!(await file.exists())) continue;
    const text = await file.text();
    const hit = scanPath(text);
    expect(hit, `tracked ${f} embeds a secret/url/key/vault path: ${hit}`).toBeNull();
  }
});

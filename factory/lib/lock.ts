import { closeSync, mkdirSync, openSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_LOCK_TIMEOUT_MS = 60_000;
const DEFAULT_STALE_MS = 120_000;

function lockTimeoutMs(): number {
  const raw = process.env.FACTORY_LOCK_TIMEOUT_MS;
  if (raw && /^[0-9]+$/.test(raw)) return Number(raw);
  return DEFAULT_LOCK_TIMEOUT_MS;
}

function staleMs(): number {
  const raw = process.env.FACTORY_LOCK_STALE_MS;
  if (raw && /^[0-9]+$/.test(raw)) return Number(raw);
  return DEFAULT_STALE_MS;
}

export async function withFileLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + lockTimeoutMs();
  const stale = staleMs();
  let fd: number | undefined;
  while (Date.now() < deadline) {
    try {
      fd = openSync(lockPath, "wx");
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw err;
      try {
        const st = statSync(lockPath);
        if (Date.now() - st.mtimeMs > stale) unlinkSync(lockPath);
      } catch {
        // raced
      }
      await Bun.sleep(20);
    }
  }
  if (fd === undefined) throw new Error("lock timeout");
  try {
    return await fn();
  } finally {
    try {
      closeSync(fd);
    } catch {
      // ignore
    }
    try {
      unlinkSync(lockPath);
    } catch {
      // ignore
    }
  }
}

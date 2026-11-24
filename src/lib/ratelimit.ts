import { headers } from "next/headers";

// In-memory fixed-window limiter. One process serves the whole site, so this
// is enough; it resets on redeploy, which is acceptable.
const hits = new Map<string, { n: number; reset: number }>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Caddy appends the real client to X-Forwarded-For; the last hop it adds is trustworthy.
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",").map((s) => s.trim()).filter(Boolean).pop()!;
  return h.get("x-real-ip") || "local";
}

/** Returns true when the action is allowed. */
export async function limit(action: string, max: number, windowSec: number, key?: string) {
  const k = `${action}:${key ?? (await clientIp())}`;
  const now = Date.now();
  const e = hits.get(k);
  if (!e || e.reset < now) {
    hits.set(k, { n: 1, reset: now + windowSec * 1000 });
    if (hits.size > 50_000) for (const [kk, v] of hits) if (v.reset < now) hits.delete(kk);
    return true;
  }
  e.n++;
  return e.n <= max;
}

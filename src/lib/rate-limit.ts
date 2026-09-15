import "server-only";

/**
 * Small in-memory sliding-window limiter for the login endpoint. One container,
 * one process, so this is enough to blunt password guessing from the internet.
 * Attempts are counted per client address AND per username, so a spoofed
 * forwarding header cannot buy unlimited guesses at one account.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_USER = 6;
const MAX_BUCKETS = 10_000;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number): number[] {
  return bucket.timestamps.filter((t) => now - t < WINDOW_MS);
}

function record(key: string, limit: number, now: number): boolean {
  const existing = buckets.get(key) ?? { timestamps: [] };
  const recent = prune(existing, now);
  buckets.set(key, { timestamps: [...recent, now] });
  return recent.length < limit;
}

function sweep(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (prune(bucket, now).length === 0) buckets.delete(key);
  }
}

/** Returns true when the caller may proceed. Records the attempt either way. */
export function allowLoginAttempt(ip: string, username: string, now = Date.now()): boolean {
  const ipOk = record(`ip:${ip}`, MAX_ATTEMPTS_PER_IP, now);
  const userOk = record(`user:${username.toLowerCase()}`, MAX_ATTEMPTS_PER_USER, now);
  sweep(now);
  return ipOk && userOk;
}

export function clearLoginAttempts(ip: string, username: string): void {
  buckets.delete(`ip:${ip}`);
  buckets.delete(`user:${username.toLowerCase()}`);
}

/**
 * Client address as seen by the reverse proxy. Nginx Proxy Manager overwrites
 * X-Real-IP with the true peer and appends the peer to X-Forwarded-For, so the
 * last forwarded entry is the one the proxy added, not one the client supplied.
 */
export function clientKey(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "direct";
}

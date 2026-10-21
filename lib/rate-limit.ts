// In-memory sliding-window limiter (single container, so no shared store needed).
// Stored on globalThis because Next.js bundles each route separately.

type Store = Map<string, number[]>;
const globalStore = globalThis as unknown as { __rateLimits?: Store };
const store: Store = (globalStore.__rateLimits ??= new Map());

export const REGISTER_LIMIT = 10;
export const REGISTER_WINDOW_MS = 60_000;

/** Records an attempt; returns false once the key exceeded `limit` attempts within `windowMs`. */
export function rateLimit(key: string, limit = REGISTER_LIMIT, windowMs = REGISTER_WINDOW_MS, now = Date.now()) {
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  store.set(key, recent);
  if (store.size > 10_000) {
    for (const [k, times] of store) if (times.every((t) => now - t >= windowMs)) store.delete(k);
  }
  return recent.length <= limit;
}

export function resetRateLimits() {
  store.clear();
}

/**
 * Client IP for rate limiting. Route handlers cannot see the socket address, so
 * this relies on headers:
 * - TRUST_PROXY_HEADER names a header that a trusted proxy overwrites on every
 *   request (cf-connecting-ip behind Cloudflare Tunnel). Use this in production.
 * - Otherwise the last x-forwarded-for hop. Next.js fills that header with the
 *   socket address only when the client did not send one, so without a trusted
 *   proxy a client can evade the limit by sending its own x-forwarded-for.
 */
export function clientIp(headers: Headers) {
  const trusted = process.env.TRUST_PROXY_HEADER?.trim().toLowerCase();
  if (trusted) {
    const value = headers.get(trusted)?.split(",")[0]?.trim();
    if (value) return value;
  }
  const hops = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return hops?.at(-1) ?? "unknown";
}

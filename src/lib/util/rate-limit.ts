import 'server-only'

import { headers } from 'next/headers'
import { clientIp } from './request'

/**
 * Fixed-window rate limiter.
 *
 * The in-process map below is correct for a single instance. On Vercel every
 * serverless instance keeps its own counter, so this raises the cost of an
 * attack without being a hard ceiling. Swap `store` for Upstash Redis (or
 * Supabase) before relying on it as a real control — the interface is the only
 * thing call sites depend on.
 */

interface Bucket {
  count: number
  resetAt: number
}

interface RateLimitStore {
  hit(key: string, windowMs: number): Promise<Bucket>
}

const memory = new Map<string, Bucket>()

const memoryStore: RateLimitStore = {
  async hit(key, windowMs) {
    const now = Date.now()
    const existing = memory.get(key)

    if (!existing || existing.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs }
      memory.set(key, fresh)
      return fresh
    }
    existing.count += 1
    return existing
  },
}

// Keep the map from growing without bound in a long-lived process.
if (typeof setInterval === 'function') {
  const sweep = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of memory) {
      if (bucket.resetAt <= now) memory.delete(key)
    }
  }, 60_000)
  sweep.unref?.()
}

const store: RateLimitStore = memoryStore

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfterSeconds: number
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const bucket = await store.hit(key, windowMs)
  const remaining = Math.max(0, limit - bucket.count)
  return {
    ok: bucket.count <= limit,
    remaining,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)),
  }
}

/** Caller identity for anonymous endpoints: the closest thing to a client IP. */
export async function callerKey(prefix: string): Promise<string> {
  // A forged or malformed forwarding header must not let a caller choose
  // their own bucket, so only a real IP address is accepted as the key.
  const ip = clientIp(await headers()) ?? 'unknown'
  return `${prefix}:${ip}`
}

import type { MiddlewareHandler } from 'hono'

interface Bucket {
  tokens: number
  lastRefill: number
}

interface RateLimitOptions {
  /** Bucket-Größe (max Tokens). */
  readonly capacity: number
  /** Tokens pro Sekunde, mit denen sich der Bucket auffüllt. */
  readonly refillPerSecond: number
  /** Fenster-Schlüssel: Funktion vom Request-Kontext. */
  readonly keyFn: (c: Parameters<MiddlewareHandler>[0]) => string
}

/**
 * Token-Bucket-Rate-Limit, in-process. Pro IP+Endpoint typischerweise verwendet.
 * Reicht für Single-Node — für Multi-Node müsste man Redis o.ä. nehmen.
 */
export function tokenBucket(opts: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>()
  return async (c, next) => {
    const key = opts.keyFn(c)
    const now = Date.now()
    let b = buckets.get(key)
    if (!b) {
      b = { tokens: opts.capacity, lastRefill: now }
      buckets.set(key, b)
    }
    const elapsed = (now - b.lastRefill) / 1000
    b.tokens = Math.min(opts.capacity, b.tokens + elapsed * opts.refillPerSecond)
    b.lastRefill = now
    if (b.tokens < 1) {
      const retrySec = Math.ceil((1 - b.tokens) / opts.refillPerSecond)
      c.header('Retry-After', String(retrySec))
      return c.json(
        { error: { code: 'rate_limit', message: 'Zu viele Anfragen, bitte später erneut.' } },
        429,
      )
    }
    b.tokens -= 1
    await next()
  }
}

export function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const fwd = c.req.header('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = c.req.header('x-real-ip')
  if (real) return real
  // hono context auf node: c.env.incoming.socket.remoteAddress wäre exakt — vereinfacht:
  return 'unknown'
}

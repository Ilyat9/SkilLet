/**
 * Простой in-memory rate limiter с TTL (достаточно для MVP на одном инстансе).
 * Ключи без свежей активности вычищаются при каждом обращении.
 */
const buckets = new Map<string, number>()

export interface RateLimitResult {
  allowed: boolean
  /** Сколько мс осталось до следующей доступной попытки. */
  retryAfterMs: number
}

export function checkRateLimit(key: string, intervalMs: number): RateLimitResult {
  const now = Date.now()

  for (const [existingKey, timestamp] of buckets) {
    if (now - timestamp >= intervalMs) {
      buckets.delete(existingKey)
    }
  }

  const lastRequestAt = buckets.get(key)
  if (lastRequestAt !== undefined && now - lastRequestAt < intervalMs) {
    return { allowed: false, retryAfterMs: intervalMs - (now - lastRequestAt) }
  }

  buckets.set(key, now)
  return { allowed: true, retryAfterMs: 0 }
}

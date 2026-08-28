/**
 * Rate limiting за явным интерфейсом.
 *
 * РЕШЕНИЕ: единственная реализация — InMemoryRateLimiter (TTL-бакеты).
 * ОГРАНИЧЕНИЕ (осознанный компромисс, не баг): in-memory реализация хранит
 * состояние в памяти процесса, поэтому при нескольких инстансах/процессах
 * приложения лимиты считаются раздельно и ослабляются в N раз.
 * Для текущего масштаба (один контейнер) это корректно. При горизонтальном
 * масштабировании нужно добавить Redis-backed реализацию RateLimiter
 * (например, фиксированное окно на INCR+EXPIRE) и вернуть её из getRateLimiter()
 * — вызывающий код в роутах менять не придётся.
 */
export interface RateLimitResult {
  allowed: boolean
  /** Сколько мс осталось до следующей доступной попытки. */
  retryAfterMs: number
}

export interface RateLimiter {
  /** Проверяет и «списывает» одну попытку для ключа в пределах intervalMs. */
  check(key: string, intervalMs: number): RateLimitResult
}

class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, number>()

  check(key: string, intervalMs: number): RateLimitResult {
    const now = Date.now()

    for (const [existingKey, timestamp] of this.buckets) {
      if (now - timestamp >= intervalMs) {
        this.buckets.delete(existingKey)
      }
    }

    const lastRequestAt = this.buckets.get(key)
    if (lastRequestAt !== undefined && now - lastRequestAt < intervalMs) {
      return { allowed: false, retryAfterMs: intervalMs - (now - lastRequestAt) }
    }

    this.buckets.set(key, now)
    return { allowed: true, retryAfterMs: 0 }
  }
}

/**
 * Точка выбора реализации. Сейчас всегда in-memory; при появлении второго
 * инстанса — переключить на Redis-реализацию здесь (env-флаг REDIS_URL).
 */
export function getRateLimiter(): RateLimiter {
  return new InMemoryRateLimiter()
}

const rateLimiter = getRateLimiter()

/** Окно по умолчанию для мутаций деревьев/узлов/рёбер. */
export const WRITE_RATE_LIMIT_MS = 60_000

/** Фасад для существующих вызовов в роутах (см. интерфейс RateLimiter выше). */
export function checkRateLimit(key: string, intervalMs: number): RateLimitResult {
  return rateLimiter.check(key, intervalMs)
}

/**
 * Единый ответ 429 для мутирующих роутов при превышении лимита.
 * Retry-After в секундах — стандартный заголовок для клиентов и мониторинга.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: { message: 'Слишком много запросов. Попробуйте чуть позже.', code: 'RATE_LIMITED' },
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
      },
    }
  )
}

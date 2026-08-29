/**
 * Rate limiting за явным интерфейсом.
 *
 * РЕШЕНИЕ: единственная реализация — InMemoryRateLimiter (fixed window counter:
 * N запросов за интервал). ОГРАНИЧЕНИЕ (осознанный компромисс, не баг):
 * in-memory реализация хранит состояние в памяти процесса, поэтому при
 * нескольких инстансах/процессах приложения лимиты считаются раздельно
 * и ослабляются в N раз. Для текущего масштаба (один контейнер) это корректно.
 * При горизонтальном масштабировании нужно добавить Redis-backed реализацию
 * RateLimiter (INCR + EXPIRE на то же семейство ключей) и вернуть её из
 * getRateLimiter() — вызывающий код в роутах менять не придётся.
 */
export interface RateLimitOptions {
  /** Сколько запросов разрешено за окно. */
  limit: number
  /** Длина окна в мс. */
  intervalMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Сколько мс осталось до следующей доступной попытки (0 — если разрешено). */
  retryAfterMs: number
}

export interface RateLimiter {
  /** Проверяет и «списывает» одну попытку для ключа в пределах окна. */
  check(key: string, options: RateLimitOptions): RateLimitResult
}

interface WindowBucket {
  windowStart: number
  hits: number
}

class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, WindowBucket>()

  check(key: string, { limit, intervalMs }: RateLimitOptions): RateLimitResult {
    const now = Date.now()
    const bucket = this.buckets.get(key)

    if (!bucket || now - bucket.windowStart >= intervalMs) {
      this.buckets.set(key, { windowStart: now, hits: 1 })
      return { allowed: true, retryAfterMs: 0 }
    }

    if (bucket.hits >= limit) {
      return { allowed: false, retryAfterMs: intervalMs - (now - bucket.windowStart) }
    }

    bucket.hits += 1
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

/**
 * Пресеты лимитов: N запросов за окно на ключ (обычно userId[:treeId]).
 * Подобраны так, чтобы не мешать обычной работе редактора (десятки мутаций
 * в минуту), но блокировать спам/скриптовые атаки.
 */
export const RATE_LIMITS = {
  /** Создание деревьев. */
  treeCreate: { limit: 10, intervalMs: 60_000 },
  /** Тяжёлое создание из шаблона (много узлов одной транзакцией). */
  treeTemplate: { limit: 5, intervalMs: 60_000 },
  /** Создание узлов (обычная работа редактора — десятки за минуту). */
  nodeCreate: { limit: 60, intervalMs: 60_000 },
  /** Обновление узлов (drag & drop координат идёт через PATCH). */
  nodeUpdate: { limit: 120, intervalMs: 60_000 },
  nodeDelete: { limit: 60, intervalMs: 60_000 },
  edgeCreate: { limit: 60, intervalMs: 60_000 },
  edgeDelete: { limit: 60, intervalMs: 60_000 },
  /** Отметки прогресса: щедрый лимит (клики по узлам), защита от спама. */
  progress: { limit: 60, intervalMs: 120_000 },
  /** Лайки: клики по кнопке сердца — спам-защита, не мешающая обычному сёрфингу. */
  like: { limit: 30, intervalMs: 60_000 },
  /** Комментарии: защита от спама в обсуждениях. */
  comment: { limit: 20, intervalMs: 60_000 },
  /** AI-генерация: дорогой внешний вызов — строже всех. */
  aiGenerate: { limit: 3, intervalMs: 60_000 },
} satisfies Record<string, RateLimitOptions>

/** Фасад для вызовов в роутах (см. интерфейс RateLimiter выше). */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  return rateLimiter.check(key, options)
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

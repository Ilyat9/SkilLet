import 'server-only'
import { captureException } from './errorTracking'

/**
 * Единое структурированное логирование API.
 *
 * РЕШЕНИЕ: обёртка над console (без pino/внешних зависимостей) — одна строка JSON на запись.
 * Обоснование: для текущего масштаба (1–2 пользователя, один инстанс) внешний
 * логгер даёт только оверхед; формат JSON-строк совместим с любым сборщиком
 * (Docker json-file → Grafana Loki/Better Stack), а точки вызова не меняются,
 * если позже захотим подменить writer на pino.
 *
 * Соглашение о полях: timestamp, level, type, route, method?, userId?,
 * requestId?, message?, stack?, ...context.
 * requestId генерируется в src/middleware.ts и возвращается клиенту
 * в заголовке X-Request-Id — так логи запроса собираются в одну цепочку.
 */

/** Контекст запроса, прокидываемый в каждый лог этого запроса. */
export interface ApiLogContext {
  method?: string
  userId?: string
  requestId?: string
  [key: string]: unknown
}

function write(level: 'error' | 'info', payload: Record<string, unknown>): void {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, ...payload })
  if (level === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

export function logApiError(route: string, error: unknown, context?: ApiLogContext): void {
  const payload = {
    type: 'api_error',
    route,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }
  write('error', payload)

  // Error tracking (Sentry и т.п.): необработанные ошибки API и ошибки Prisma
  // должны попадать в трекинг с контекстом route/requestId/userId.
  captureException(error, { route, ...context })
}

/** Небольшое информационное событие API (для отладки при необходимости). */
export function logApiInfo(route: string, message: string, context?: ApiLogContext): void {
  write('info', { type: 'api_event', route, message, ...context })
}

/**
 * Бизнес-событие (ключевые события продукта): tree_created, ai_tree_generated,
 * progress_marked, achievement_unlocked и т.п. Единый type: 'business_event'
 * и поле event — задел под аналитику без Prometheus-инфраструктуры сейчас.
 */
export function logEvent(event: string, fields: ApiLogContext): void {
  write('info', { type: 'business_event', event, ...fields })
}

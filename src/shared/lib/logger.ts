import 'server-only'

/**
 * Единое структурированное логирование ошибок API.
 * Формат — одна строка JSON: level/type/route/timestamp/message/stack + контекст,
 * чтобы любой внешний error-tracking (Sentry, Better Stack и т.п.) можно было
 * подключить одной точкой вызова здесь.
 */
export function logApiError(route: string, error: unknown, context?: Record<string, unknown>): void {
  const payload = {
    level: 'error',
    type: 'api_error',
    route,
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }
  console.error(JSON.stringify(payload))
}

/** Небольшое информационное событие API (для отладки при необходимости). */
export function logApiInfo(route: string, message: string, context?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({ level: 'info', type: 'api_event', route, timestamp: new Date().toISOString(), message, ...context })
  )
}

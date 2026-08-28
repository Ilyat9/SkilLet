import 'server-only'
import type { NextRequest } from 'next/server'

/**
 * Достаёт requestId запроса, сгенерированный в src/middleware.ts
 * (заголовок x-request-id). Fallback — собственная генерация, если middleware
 * не отработал (например, запрос в обход matcher'а).
 * Используется в route handlers для прокидывания requestId в логи.
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get('x-request-id') ?? crypto.randomUUID()
}
import { NextRequest, NextResponse } from 'next/server'

/**
 * Прокидывает requestId в каждый API-запрос:
 * - генерирует (или подхватывает из входящего заголовка x-request-id — чтобы
 *   трассировка сквозь прокси/балансировщик сохраняла id);
 * - передаёт его в хендлеры через заголовок запроса (роуты читают
 *   getRequestId(request) и кладут в каждый лог);
 * - возвращает клиенту в X-Request-Id — при разборе инцидента пользователь
 *   может назвать id, и по нему находятся все логи запроса.
 */
export function middleware(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-request-id', requestId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('X-Request-Id', requestId)
  return response
}

export const config = {
  // Всё, кроме статики Next.js и фавиконок (API и страницы получают request-id).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
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

  /*
   * Канонизация хоста: после каждого деплоя Vercel показывает кнопку «Visit»
   * на адресе конкретной сборки (<project>-<hash>-<team>.vercel.app). OAuth-флоу,
   * начатый с деплой-домена, падает в callback'е: NEXTAUTH_URL ведёт колбэк на
   * прод-домен, а PKCE-cookie (__Host-*) привязан к хосту, где начался вход
   * (см. InvalidCheck: pkceCodeVerifier). Редиректим все заходы на URL деплоя
   * на канонический домен (308 — с сохранением метода и тела для POST).
   * Условие «host === deployment-url» отсекает прод-домен и кастомные домены —
   * они редиректить сами в себя не должны. Локально (нет NEXTAUTH_URL) — skip.
   */
  const authUrl = process.env.NEXTAUTH_URL
  const deploymentUrl = request.headers.get('x-vercel-deployment-url')
  if (authUrl && deploymentUrl) {
    try {
      const canonicalHost = new URL(authUrl).host
      const deploymentHost = new URL(deploymentUrl.includes('://') ? deploymentUrl : `https://${deploymentUrl}`).host
      const requestHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
      if (canonicalHost && requestHost === deploymentHost && requestHost !== canonicalHost) {
        const canonical = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${canonicalHost}`)
        return NextResponse.redirect(canonical, 308)
      }
    } catch {
      // Некорректный NEXTAUTH_URL/заголовок — не мешаем запросу, это не его проблема.
    }
  }

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
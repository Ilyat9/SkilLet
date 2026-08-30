import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { handlers } from '@/shared/lib/auth'


/**
 * GitHub App (в отличие от классического OAuth App) добавляет в callback
 * параметр `iss=https://github.com/login/oauth`. Встроенная в Auth.js защита
 * от mix-up атак отвергает посторонний issuer — см. ошибку
 * «unexpected "iss" (issuer) response parameter value». Срезаем `iss`
 * и повторяем запрос: state-cookie сохраняется, флоу продолжается штатно.
 */
// В beta.30 хендлер принимает только Request: экшен ([...nextauth]) он
// определяет из pathname самого запроса, params ему не нужен.
export async function GET(req: Request, _ctx: unknown) {
  const url = new URL(req.url)
  if (url.searchParams.has('iss')) {
    url.searchParams.delete('iss')
    return NextResponse.redirect(url)
  }
  return handlers.GET(req as NextRequest)
}

export const POST = handlers.POST

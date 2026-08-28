import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/shared/lib/utils'

/**
 * Лимит размера входящего JSON-тела.
 *
 * Механизм в App Router: config-опция `bodyParser.sizeLimit` из Pages Router
 * НЕ работает в Route Handlers — тело читается вручную через request.json(),
 * поэтому лимит применяется здесь, до/во время парсинга: сначала по
 * Content-Length (дёшево, до чтения потока), затем по фактическому размеру
 * прочитанного текста (защита от отсутствующего/лживого Content-Length).
 */
export const MAX_BODY_BYTES = 1024 * 1024 // 1 MiB — с запасом больше любого валидного payload проекта

/**
 * Безопасно разбирает тело запроса. Некорректный/пустой/чрезмерно большой JSON —
 * частые причины необработанных исключений и «протечек» в 500, поэтому парсинг
 * вынесен в единую точку с понятными ответами 400/413.
 */
export async function parseJsonBody(
  request: NextRequest
): Promise<{ body: unknown; error: null } | { body: null; error: NextResponse }> {
  try {
    const contentLength = Number(request.headers.get('content-length') ?? '0')
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return {
        body: null,
        error: NextResponse.json(
          createErrorResponse('Тело запроса слишком большое', 'PAYLOAD_TOO_LARGE'),
          { status: 413 }
        ),
      }
    }

    const text = await request.text()
    if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
      return {
        body: null,
        error: NextResponse.json(
          createErrorResponse('Тело запроса слишком большое', 'PAYLOAD_TOO_LARGE'),
          { status: 413 }
        ),
      }
    }

    return { body: text.length === 0 ? null : JSON.parse(text), error: null }
  } catch {
    return {
      body: null,
      error: NextResponse.json(
        createErrorResponse('Ожидается корректный JSON в теле запроса', 'VALIDATION_ERROR'),
        { status: 400 }
      ),
    }
  }
}

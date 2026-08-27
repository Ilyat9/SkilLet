import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse } from '@/shared/lib/utils'

/**
 * Безопасно разбирает тело запроса. Некорректный/пустой JSON — частая причина
 * необработанных исключений и «протечек» в 500, поэтому парсинг вынесен
 * в единую точку с понятным ответом 400 VALIDATION_ERROR.
 */
export async function parseJsonBody(
  request: NextRequest
): Promise<{ body: unknown; error: null } | { body: null; error: NextResponse }> {
  try {
    const body = await request.json()
    return { body, error: null }
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

import { NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { logApiError } from '@/shared/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Health-check для мониторинга аптайма (UptimeRobot и т.п.):
 * проверяет соединение с Postgres через prisma.$queryRaw('SELECT 1').
 * 200 — приложение и БД живы; 503 — БД недоступна.
 */
export async function GET() {
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logApiError('GET /api/health', error)

    return NextResponse.json(
      {
        status: 'error',
        db: 'unavailable',
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}

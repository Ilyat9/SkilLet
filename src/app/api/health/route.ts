import { NextResponse, type NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/shared/lib/prisma'
import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Версия приложения из package.json. В standalone-сборке package.json копируется в бандл. */
function getAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { version?: string }
    return pkg.version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Health-check для мониторинга аптайма (UptimeRobot, Docker healthcheck и т.п.):
 * - проверяет соединение с Postgres (SELECT 1) и замеряет задержку —
 *   полезно для наблюдения деградации, а не только бинарного up/down;
 * - отдаёт версию приложения и uptime процесса.
 * 200 — приложение и БД живы; 503 — БД недоступна.
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const startedAt = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'ok',
        db: 'ok',
        latencyMs: Date.now() - startedAt,
        version: getAppVersion(),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { headers: { 'X-Request-Id': requestId } }
    )
  } catch (error) {
    logApiError('GET /api/health', error, { requestId })

    return NextResponse.json(
      {
        status: 'error',
        db: 'unavailable',
        latencyMs: Date.now() - startedAt,
        version: getAppVersion(),
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'X-Request-Id': requestId } }
    )
  }
}

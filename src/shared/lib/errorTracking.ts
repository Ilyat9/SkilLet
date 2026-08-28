import 'server-only'

/**
 * Минимальный error-tracking без SDK: отправка событий напрямую в Sentry
 * через Envelope API (POST https://<host>/api/<projectId>/envelope/).
 *
 * РЕШЕНИЕ: не добавляем @sentry/nextjs (~тяжёлая зависимость, требует
 * обвязки сборки) — на текущем масштабе достаточно отправки исключений
 * fire-and-forget с таймаутом. Транспорт полностью локализован здесь:
 * при будущем переходе на SDK меняется только этот файл.
 *
 * Активация: задайте SENTRY_DSN в переменных окружения (формат
 * https://<publicKey>@<host>/<projectId>). Без DSN — no-op (dev/локально).
 */

interface ErrorContext {
  route?: string
  userId?: string
  requestId?: string
  [key: string]: unknown
}

interface ParsedDsn {
  publicKey: string
  host: string
  projectId: string
}

function parseDsn(dsn: string): ParsedDsn | null {
  const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/)
  if (!match?.[1] || !match[2] || !match[3]) return null
  return { publicKey: match[1], host: match[2], projectId: match[3] }
}

function serializeError(error: unknown): { type: string; value: string; stacktrace?: string } {
  if (error instanceof Error) {
    return {
      type: error.name,
      value: error.message,
      ...(error.stack ? { stacktrace: error.stack } : {}),
    }
  }
  return { type: 'UnknownError', value: String(error) }
}

export function captureException(error: unknown, context: ErrorContext = {}): void {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) return

  const parsed = parseDsn(dsn)
  if (!parsed) return

  const eventId = crypto.randomUUID()
  const sentAt = new Date().toISOString()

  // Envelope: строка заголовков + JSON-полезная нагрузка события.
  const envelopeHeaders = JSON.stringify({ event_id: eventId, sent_at: sentAt })
  const itemHeaders = JSON.stringify({ type: 'event' })
  const item = JSON.stringify({
    event_id: eventId,
    timestamp: sentAt,
    platform: 'javascript:node',
    environment: process.env.NODE_ENV ?? 'development',
    level: 'error',
    logger: 'skillet.api',
    exception: { values: [serializeError(error)] },
    tags: {
      ...(context.route ? { route: context.route } : {}),
      ...(context.requestId ? { request_id: context.requestId } : {}),
      ...(context.userId ? { user_id: context.userId } : {}),
    },
    ...(context.userId ? { user: { id: context.userId } } : {}),
    extra: context,
  })

  // Fire-and-forget: ошибка доставки не должна влиять на ответ API.
  void fetch(`https://${parsed.host}/api/${parsed.projectId}/envelope/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-sentry-envelope',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.publicKey}`,
    },
    body: `${envelopeHeaders}\n${itemHeaders}\n${item}`,
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {
    // Тихо игнорируем: логгер уже записал ошибку в stdout.
  })
}
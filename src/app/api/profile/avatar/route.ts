import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Разрешённые источники аватара. Список синхронизирован с CSP (next.config.ts):
 * DiceBear — детерминированные генеративные SVG-аватары (не нейросеть),
 * avatars.githubusercontent.com — оригинальное фото GitHub.
 */
const AVATAR_HOSTS = ['api.dicebear.com', 'avatars.githubusercontent.com']

const AvatarSchema = z.object({
  // null — сброс на фото GitHub (поле image).
  avatarUrl: z.string().max(500).nullable(),
})

// POST /api/profile/avatar — сохранить/сбросить выбранный аватар пользователя.
export async function POST(request: NextRequest) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(createErrorResponse('Unauthorized', 'UNAUTHORIZED'), { status: 401 })
    }

    const body = AvatarSchema.safeParse(await request.json())
    if (!body.success) {
      return NextResponse.json(createErrorResponse('Некорректное тело запроса', 'VALIDATION_ERROR'), { status: 400 })
    }

    const { avatarUrl } = body.data
    if (avatarUrl !== null) {
      let parsed: URL
      try {
        parsed = new URL(avatarUrl)
      } catch {
        return NextResponse.json(createErrorResponse('Некорректный URL аватара', 'VALIDATION_ERROR'), { status: 400 })
      }
      if (parsed.protocol !== 'https:' || !AVATAR_HOSTS.includes(parsed.hostname)) {
        return NextResponse.json(
          createErrorResponse('URL аватара должен вести на разрешённый источник', 'VALIDATION_ERROR'),
          { status: 400 }
        )
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { avatarUrl },
      select: { id: true, avatarUrl: true, image: true },
    })

    return NextResponse.json(createSuccessResponse({ avatarUrl: user.avatarUrl, image: user.image }))
  } catch (error) {
    logApiError('POST /api/profile/avatar', error, { requestId })
    return NextResponse.json(createErrorResponse('Internal server error', 'INTERNAL_ERROR'), { status: 500 })
  }
}

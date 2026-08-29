import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/trees/[id]/like — переключение лайка текущего пользователя:
 * лайк не стоит → создаётся, стоит → снимается. Идемпотентный тоггл по
 * уникальному constraint TreeLike(userId, treeId) — гонки параллельных
 * кликов не создают дублей.
 * Ответ всегда содержит актуальные счётчик и состояние liked.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }
    const userId = session.user.id

    // Rate limit: клики по кнопке лайка — защита от спама и гонок.
    const { id: treeId } = await params
    const rateLimit = checkRateLimit(`like:${userId}`, RATE_LIMITS.like)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    // Дерево должно существовать и быть доступным (публичным или своим):
    // лайкать приватные чужие деревья нельзя.
    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true, authorId: true, isPublic: true },
    })
    if (!tree || (!tree.isPublic && tree.authorId !== userId)) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const existing = await prisma.treeLike.findUnique({
      where: { userId_treeId: { userId, treeId } },
      select: { id: true },
    })

    let liked: boolean
    if (existing) {
      await prisma.treeLike.delete({ where: { id: existing.id } })
      liked = false
    } else {
      try {
        await prisma.treeLike.create({ data: { userId, treeId } })
        liked = true
      } catch {
        // Гонка двух параллельных кликов: unique constraint уже сработал —
        // трактуем как «лайк уже стоит», а не как ошибку.
        liked = true
      }
    }

    const likes = await prisma.treeLike.count({ where: { treeId } })

    logEvent(liked ? 'tree_liked' : 'tree_unliked', {
      userId,
      treeId,
      likes,
      requestId,
    })

    return NextResponse.json(createSuccessResponse({ liked, likes }))
  } catch (error) {
    logApiError('POST /api/trees/[id]/like', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
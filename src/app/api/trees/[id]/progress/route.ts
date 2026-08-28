import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'
import { computeNextStreak } from '@/shared/lib/gamification'
import { checkAndGrantAchievements } from '@/features/achievements/model/achievementService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const ProgressSchema = z.object({
  nodeId: z.string().min(1, 'nodeId обязателен'),
  completed: z.boolean(),
})

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    // Rate limit на переключение прогресса: щедрый лимит (клики по узлам), но защита от спама.
    const progressRateLimit = checkRateLimit(`progress:${session.user.id}`, RATE_LIMITS.progress)
    if (!progressRateLimit.allowed) {
      return rateLimitResponse(progressRateLimit)
    }

    const { id: treeId } = await params

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = ProgressSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    // treeId берём строго из URL — не доверяем body.
    const { nodeId, completed } = validation.data

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        nodes: true,
      },
    })

    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const node = tree.nodes.find(n => n.id === nodeId)
    if (!node) {
      return NextResponse.json(
        createErrorResponse('Node not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    if (tree.authorId !== session.user.id && !tree.isPublic) {
      return NextResponse.json(
        createErrorResponse('Access denied', 'FORBIDDEN'),
        { status: 403 }
      )
    }

    const existingProgress = await prisma.userProgress.findUnique({
      where: {
        userId_nodeId: {
          userId: session.user.id,
          nodeId,
        },
      },
    })

    let progress
    if (existingProgress) {
      progress = await prisma.userProgress.update({
        where: {
          userId_nodeId: {
            userId: session.user.id,
            nodeId,
          },
        },
        data: {
          completed,
          completedAt: completed ? new Date() : null,
        },
      })
    } else {
      progress = await prisma.userProgress.create({
        data: {
          userId: session.user.id,
          treeId,
          nodeId,
          completed,
          completedAt: completed ? new Date() : null,
        },
      })
    }

    const userId = session.user.id

    // Streak обновляется только при отметке «пройдено» — снятие прогресса
    // не должно ни продлевать, ни сбрасывать серию.
    if (completed) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { lastActivityDate: true, currentStreak: true, longestStreak: true },
      })

      if (user) {
        const nextStreak = computeNextStreak({
          lastActivityDate: user.lastActivityDate,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
          today: new Date(),
        })

        await prisma.user.update({
          where: { id: userId },
          data: {
            lastActivityDate: nextStreak.lastActivityDate,
            currentStreak: nextStreak.currentStreak,
            longestStreak: nextStreak.longestStreak,
          },
        })
      }
    }

    // Проверка достижений после сохранения прогресса.
    const unlockedAchievements = completed ? await checkAndGrantAchievements(userId, treeId) : []

    // Бизнес-события для аналитики: отметка прогресса и разблокировка достижений.
    logEvent('progress_marked', {
      userId,
      treeId,
      nodeId,
      completed,
      requestId: getRequestId(request),
    })
    if (unlockedAchievements.length > 0) {
      logEvent('achievement_unlocked', {
        userId,
        treeId,
        codes: unlockedAchievements.map((a) => a.code),
        requestId: getRequestId(request),
      })
    }

    const streakState = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true },
    })

    return NextResponse.json(
      createSuccessResponse({
        progress,
        unlockedAchievements,
        streak: streakState ?? { currentStreak: 0, longestStreak: 0 },
      })
    )
  } catch (error) {
    logApiError('POST /api/trees/[id]/progress', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

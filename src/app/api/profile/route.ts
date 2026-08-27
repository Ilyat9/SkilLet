import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/profile — сводная статистика текущего пользователя
// (пройдено узлов, создано деревьев, streak, достижения).
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }
    const userId = session.user.id

    const [user, completedNodes, createdTrees, unlockedAchievements] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          image: true,
          email: true,
          currentStreak: true,
          longestStreak: true,
          lastActivityDate: true,
        },
      }),
      prisma.userProgress.count({ where: { userId, completed: true } }),
      prisma.tree.count({ where: { authorId: userId } }),
      prisma.userAchievement.findMany({
        where: { userId },
        orderBy: { unlockedAt: 'desc' },
        include: { achievement: true },
      }),
    ])

    if (!user) {
      return NextResponse.json(
        createErrorResponse('User not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    return NextResponse.json(
      createSuccessResponse({
        user,
        stats: {
          completedNodes,
          createdTrees,
          currentStreak: user.currentStreak,
          longestStreak: user.longestStreak,
        },
        achievements: unlockedAchievements.map((ua) => ({
          code: ua.achievement.code,
          title: ua.achievement.title,
          description: ua.achievement.description,
          icon: ua.achievement.icon,
          unlockedAt: ua.unlockedAt,
        })),
      })
    )
  } catch (error) {
    console.error('[GET /api/profile]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

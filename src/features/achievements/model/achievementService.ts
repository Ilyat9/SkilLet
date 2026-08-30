import 'server-only'
import { prisma } from '@/shared/lib/prisma'
import {
  computeEarnedAchievementCodes,
  type AchievementStats,
} from '@/shared/lib/gamification'
import type { Achievement } from '@prisma/client'

/**
 * Проверяет условия достижений пользователя после отметки прогресса
 * и выдаёт новые достижения. Возвращает только что разблокированные
 * записи каталога (пустой массив — если ничего нового).
 */
export async function checkAndGrantAchievements(userId: string, treeId: string): Promise<Achievement[]> {
  const [user, totalCompletedNodes, targetTree, ownTrees, startedTrees, commentsWritten, likesReceived, completedByTree, lastProgress] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { currentStreak: true } }),
      prisma.userProgress.count({ where: { userId, completed: true } }),
      // Прогресс именно по проверяемому дереву + общее число его узлов.
      prisma.tree.findUnique({
        where: { id: treeId },
        select: {
          _count: { select: { nodes: true } },
          progresses: { where: { userId, completed: true }, select: { nodeId: true } },
        },
      }),
      // Статистика по собственным деревьям: максимум узлов и максимум рёбер.
      prisma.tree.findMany({
        where: { authorId: userId },
        select: { _count: { select: { nodes: true, edges: true } } },
      }),
      // Исследователь: сколько разных деревьев затронуто пройденными узлами.
      prisma.userProgress.findMany({
        where: { userId, completed: true },
        select: { treeId: true },
        distinct: ['treeId'],
      }),
      prisma.comment.count({ where: { authorId: userId } }),
      // Любимец публики: лайки на деревьях пользователя.
      prisma.treeLike.count({ where: { tree: { authorId: userId } } }),
      // Перфекционист: сколько деревьев пройдено полностью — сравниваем
      // число пройденных узлов в дереве с общим числом его узлов.
      prisma.userProgress.groupBy({
        by: ['treeId'],
        where: { userId, completed: true },
        _count: { _all: true },
      }),
      // Ночная сова: час последней отметки.
      prisma.userProgress.findFirst({
        where: { userId, completed: true },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
    ])

  // Деревья, где пройдены все узлы: сопоставляем счётчики прогресса с узлами деревьев.
  const completedCounts = new Map(completedByTree.map((row) => [row.treeId, row._count._all]))
  const candidateTreeIds = [...completedCounts.keys()]
  const nodeCounts = candidateTreeIds.length
    ? await prisma.tree.findMany({
        where: { id: { in: candidateTreeIds } },
        select: { id: true, _count: { select: { nodes: true } } },
      })
    : []
  const fullyCompletedTrees = nodeCounts.filter(
    (t) => t._count.nodes > 0 && (completedCounts.get(t.id) ?? 0) >= t._count.nodes
  ).length

  const maxNodesInOwnTree = Math.max(0, ...ownTrees.map((t) => t._count.nodes))

  const stats: AchievementStats = {
    totalCompletedNodes,
    isTreeFullyCompleted: Boolean(
      targetTree && targetTree._count.nodes > 0 && targetTree.progresses.length >= targetTree._count.nodes
    ),
    ownTreesCount: ownTrees.length,
    maxNodesInOwnTree,
    // Ацикличность гарантируется конструцией: все рёбра проходят validateEdge
    // при создании (самопетля/дубликат/цикл запрещены), поэтому 10+ рёбер
    // в любом дереве проекта — ациклический граф.
    hasOwnTreeWith10PlusEdges: ownTrees.some((t) => t._count.edges >= 10),
    currentStreak: user?.currentStreak ?? 0,
    distinctTreesStarted: startedTrees.length,
    commentsWritten,
    likesReceived,
    fullyCompletedTrees,
    lastProgressHourUtc: lastProgress?.completedAt ? lastProgress.completedAt.getUTCHours() : null,
  }

  const earnedCodes = computeEarnedAchievementCodes(stats)
  if (earnedCodes.length === 0) return []

  const catalog = await prisma.achievement.findMany({
    where: { code: { in: earnedCodes } },
  })

  const alreadyUnlockedIds = new Set(
    (
      await prisma.userAchievement.findMany({
        where: { userId, achievementId: { in: catalog.map((a) => a.id) } },
        select: { achievementId: true },
      })
    ).map((ua) => ua.achievementId)
  )

  const newlyEarned = catalog.filter((a) => !alreadyUnlockedIds.has(a.id))
  if (newlyEarned.length === 0) return []

  await prisma.userAchievement.createMany({
    data: newlyEarned.map((achievement) => ({ userId, achievementId: achievement.id })),
    skipDuplicates: true,
  })

  return newlyEarned
}

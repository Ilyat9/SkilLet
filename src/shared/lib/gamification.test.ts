import { describe, expect, it } from 'vitest'
import {
  computeEarnedAchievementCodes,
  computeNextStreak,
  ACHIEVEMENT_CODES,
} from './gamification'

const baseStats = {
  totalCompletedNodes: 0,
  isTreeFullyCompleted: false,
  ownTreesCount: 0,
  maxNodesInOwnTree: 0,
  hasOwnTreeWith10PlusEdges: false,
  currentStreak: 0,
  distinctTreesStarted: 0,
  commentsWritten: 0,
  likesReceived: 0,
  fullyCompletedTrees: 0,
  lastProgressHourUtc: null,
}

describe('computeNextStreak', () => {
  const today = new Date('2026-08-27T12:00:00Z')

  it('первая активность — серия 1', () => {
    const result = computeNextStreak({
      lastActivityDate: null,
      currentStreak: 0,
      longestStreak: 0,
      today,
    })
    expect(result).toEqual({ lastActivityDate: today, currentStreak: 1, longestStreak: 1 })
  })

  it('активность вчера — серия +1 и рост longest', () => {
    const yesterday = new Date('2026-08-26T09:00:00Z')
    const result = computeNextStreak({
      lastActivityDate: yesterday,
      currentStreak: 4,
      longestStreak: 7,
      today,
    })
    expect(result.currentStreak).toBe(5)
    expect(result.longestStreak).toBe(7)
  })

  it('активность сегодня — серия не меняется', () => {
    const earlierToday = new Date('2026-08-27T01:00:00Z')
    const result = computeNextStreak({
      lastActivityDate: earlierToday,
      currentStreak: 3,
      longestStreak: 10,
      today,
    })
    expect(result.currentStreak).toBe(3)
    expect(result.longestStreak).toBe(10)
  })

  it('пропуск дня — сброс в 1, longest сохраняет рекорд', () => {
    const threeDaysAgo = new Date('2026-08-24T23:00:00Z')
    const result = computeNextStreak({
      lastActivityDate: threeDaysAgo,
      currentStreak: 9,
      longestStreak: 9,
      today,
    })
    expect(result.currentStreak).toBe(1)
    expect(result.longestStreak).toBe(9)
  })

  it('серия догоняет и обгоняет рекорд', () => {
    const yesterday = new Date('2026-08-26T00:30:00Z')
    const result = computeNextStreak({
      lastActivityDate: yesterday,
      currentStreak: 9,
      longestStreak: 9,
      today,
    })
    expect(result.currentStreak).toBe(10)
    expect(result.longestStreak).toBe(10)
  })

  it('UTC-границы суток учитываются корректно (локальные часовые пояса не ломают логику)', () => {
    const result = computeNextStreak({
      // 22:50 UTC вчера
      lastActivityDate: new Date('2026-08-26T22:50:00Z'),
      currentStreak: 2,
      longestStreak: 2,
      today: new Date('2026-08-27T00:05:00Z'),
    })
    expect(result.currentStreak).toBe(3)
  })
})

describe('computeEarnedAchievementCodes', () => {
  it('нет прогресса — достижений нет', () => {
    expect(computeEarnedAchievementCodes(baseStats)).toEqual([])
  })

  it('первый завершённый узел даёт «Первые шаги»', () => {
    const codes = computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 1 })
    expect(codes).toEqual([ACHIEVEMENT_CODES.FIRST_STEPS])
  })

  it('все узлы дерева завершены — «Дерево пройдено»', () => {
    const codes = computeEarnedAchievementCodes({
      ...baseStats,
      totalCompletedNodes: 5,
      isTreeFullyCompleted: true,
    })
    expect(codes).toContain(ACHIEVEMENT_CODES.FIRST_STEPS)
    expect(codes).toContain(ACHIEVEMENT_CODES.TREE_COMPLETED)
  })

  it('isTreeFullyCompleted без единого пройденного узла не выдаёт достижение (пустое дерево)', () => {
    const codes = computeEarnedAchievementCodes({ ...baseStats, isTreeFullyCompleted: true })
    expect(codes).toEqual([])
  })

  it('20+ узлов суммарно дают «Марафонец»', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 19 })).not.toContain(
      ACHIEVEMENT_CODES.MARATHON
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 20 })).toContain(
      ACHIEVEMENT_CODES.MARATHON
    )
  })

  it('«Создатель»: своё дерево с 5+ узлами', () => {
    const stats = { ...baseStats, ownTreesCount: 1, maxNodesInOwnTree: 5 }
    expect(computeEarnedAchievementCodes(stats)).toContain(ACHIEVEMENT_CODES.CREATOR)

    const notEnough = { ...baseStats, ownTreesCount: 1, maxNodesInOwnTree: 4 }
    expect(computeEarnedAchievementCodes(notEnough)).not.toContain(ACHIEVEMENT_CODES.CREATOR)
  })

  it('«Архитектор связей»: дерево с 10+ рёбрами', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, hasOwnTreeWith10PlusEdges: true })).toContain(
      ACHIEVEMENT_CODES.CONNECTOR
    )
  })

  it('все условия одновременно — выданы все пять', () => {
    const codes = computeEarnedAchievementCodes({
      ...baseStats,
      totalCompletedNodes: 25,
      isTreeFullyCompleted: true,
      ownTreesCount: 2,
      maxNodesInOwnTree: 8,
      hasOwnTreeWith10PlusEdges: true,
    })
    expect(codes).toHaveLength(5)
  })

  it('«Огонь»: серия 7 дней', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, currentStreak: 6 })).not.toContain(
      ACHIEVEMENT_CODES.STREAK_WEEK
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, currentStreak: 7 })).toContain(
      ACHIEVEMENT_CODES.STREAK_WEEK
    )
  })

  it('«Исследователь»: 5 разных деревьев', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, distinctTreesStarted: 4 })).not.toContain(
      ACHIEVEMENT_CODES.EXPLORER
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, distinctTreesStarted: 5 })).toContain(
      ACHIEVEMENT_CODES.EXPLORER
    )
  })

  it('«Голос сообщества»: 3 комментария', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, commentsWritten: 2 })).not.toContain(
      ACHIEVEMENT_CODES.VOICE
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, commentsWritten: 3 })).toContain(
      ACHIEVEMENT_CODES.VOICE
    )
  })

  it('«Любимец публики»: 5 лайков на своих деревьях', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, likesReceived: 4 })).not.toContain(
      ACHIEVEMENT_CODES.FAVORITE
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, likesReceived: 5 })).toContain(
      ACHIEVEMENT_CODES.FAVORITE
    )
  })

  it('«Куратор»: 3 своих дерева', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, ownTreesCount: 2 })).not.toContain(
      ACHIEVEMENT_CODES.CURATOR
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, ownTreesCount: 3 })).toContain(
      ACHIEVEMENT_CODES.CURATOR
    )
  })

  it('«Сотка»: 100 узлов суммарно', () => {
    expect(computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 99 })).not.toContain(
      ACHIEVEMENT_CODES.CENTURION
    )
    expect(computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 100 })).toContain(
      ACHIEVEMENT_CODES.CENTURION
    )
  })

  it('секретная «Ночная сова»: отметка ночью (22–05 UTC) при наличии прогресса', () => {
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 1, lastProgressHourUtc: 23 })
    ).toContain(ACHIEVEMENT_CODES.NIGHT_OWL)
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 1, lastProgressHourUtc: 3 })
    ).toContain(ACHIEVEMENT_CODES.NIGHT_OWL)
    // Днём — нет.
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 1, lastProgressHourUtc: 12 })
    ).not.toContain(ACHIEVEMENT_CODES.NIGHT_OWL)
    // Ночью, но без единого узла — нет (нечем отметить).
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 0, lastProgressHourUtc: 23 })
    ).not.toContain(ACHIEVEMENT_CODES.NIGHT_OWL)
  })

  it('секретный «Перфекционист»: 3 дерева полностью', () => {
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 10, fullyCompletedTrees: 2 })
    ).not.toContain(ACHIEVEMENT_CODES.PERFECTIONIST)
    expect(
      computeEarnedAchievementCodes({ ...baseStats, totalCompletedNodes: 15, fullyCompletedTrees: 3 })
    ).toContain(ACHIEVEMENT_CODES.PERFECTIONIST)
  })

  it('каталог содержит только известные коды, секретные помечены', async () => {
    const { ACHIEVEMENT_DEFS } = await import('./gamification')
    const knownCodes = new Set(Object.values(ACHIEVEMENT_CODES))
    for (const def of ACHIEVEMENT_DEFS) {
      expect(knownCodes.has(def.code)).toBe(true)
    }
    expect(ACHIEVEMENT_DEFS.filter((d) => d.secret).map((d) => d.code)).toEqual([
      ACHIEVEMENT_CODES.NIGHT_OWL,
      ACHIEVEMENT_CODES.PERFECTIONIST,
    ])
  })
})

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
      totalCompletedNodes: 25,
      isTreeFullyCompleted: true,
      ownTreesCount: 2,
      maxNodesInOwnTree: 8,
      hasOwnTreeWith10PlusEdges: true,
    })
    expect(codes).toHaveLength(5)
  })
})

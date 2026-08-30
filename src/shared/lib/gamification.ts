/**
 * Чистая бизнес-логика геймификации: streak и достижения.
 * Файл не зависит от рантайма (Prisma/Next) — используется и на сервере
 * (проверка достижений в API), и в тестах, и сидированием каталога.
 */

export const ACHIEVEMENT_CODES = {
  FIRST_STEPS: 'first-steps',
  TREE_COMPLETED: 'tree-completed',
  MARATHON: 'marathon',
  CREATOR: 'creator',
  CONNECTOR: 'architect-of-connections',
  STREAK_WEEK: 'streak-week',
  EXPLORER: 'explorer',
  VOICE: 'voice',
  FAVORITE: 'favorite',
  CURATOR: 'curator',
  CENTURION: 'centurion',
  NIGHT_OWL: 'night-owl',
  PERFECTIONIST: 'perfectionist',
} as const

export type AchievementCode = (typeof ACHIEVEMENT_CODES)[keyof typeof ACHIEVEMENT_CODES]

export interface AchievementDef {
  code: AchievementCode
  title: string
  description: string
  icon: string
  /** Секретные скрыты в профиле («Секретное достижение»), пока не получены. */
  secret?: boolean
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  {
    code: ACHIEVEMENT_CODES.FIRST_STEPS,
    title: 'Первые шаги',
    description: 'Завершите первый узел любого дерева',
    icon: '👣',
  },
  {
    code: ACHIEVEMENT_CODES.TREE_COMPLETED,
    title: 'Дерево пройдено',
    description: 'Завершите все узлы одного дерева',
    icon: '🌳',
  },
  {
    code: ACHIEVEMENT_CODES.MARATHON,
    title: 'Марафонец',
    description: 'Завершите 20+ узлов суммарно по всем деревьям',
    icon: '🏃',
  },
  {
    code: ACHIEVEMENT_CODES.CREATOR,
    title: 'Создатель',
    description: 'Создайте собственное дерево с 5+ узлами',
    icon: '🛠️',
  },
  {
    code: ACHIEVEMENT_CODES.CONNECTOR,
    title: 'Архитектор связей',
    description: 'Создайте дерево с 10+ связями без циклов',
    icon: '🕸️',
  },
  {
    code: ACHIEVEMENT_CODES.STREAK_WEEK,
    title: 'Огонь',
    description: 'Занимайтесь 7 дней подряд',
    icon: '🔥',
  },
  {
    code: ACHIEVEMENT_CODES.EXPLORER,
    title: 'Исследователь',
    description: 'Начните 5 разных деревьев',
    icon: '🧭',
  },
  {
    code: ACHIEVEMENT_CODES.VOICE,
    title: 'Голос сообщества',
    description: 'Оставьте 3 комментария к деревьям',
    icon: '💬',
  },
  {
    code: ACHIEVEMENT_CODES.FAVORITE,
    title: 'Любимец публики',
    description: 'Соберите 5 лайков на своих деревьях',
    icon: '❤️',
  },
  {
    code: ACHIEVEMENT_CODES.CURATOR,
    title: 'Куратор',
    description: 'Создайте 3 собственных дерева',
    icon: '📚',
  },
  {
    code: ACHIEVEMENT_CODES.CENTURION,
    title: 'Сотка',
    description: 'Завершите 100 узлов суммарно по всем деревьям',
    icon: '💯',
  },
  {
    code: ACHIEVEMENT_CODES.NIGHT_OWL,
    title: 'Ночная сова',
    description: 'Отметьте узел пройденным ночью',
    icon: '🦉',
    secret: true,
  },
  {
    code: ACHIEVEMENT_CODES.PERFECTIONIST,
    title: 'Перфекционист',
    description: 'Полностью пройдите 3 дерева',
    icon: '🎯',
    secret: true,
  },
] as const

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

/** Приводит дату к UTC-полуночи — базовая единица сравнения дней. */
function toUtcDay(date: Date): number {
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000)
}

export interface StreakStateInput {
  lastActivityDate: Date | null
  currentStreak: number
  longestStreak: number
  today: Date
}

export interface StreakStateOutput {
  lastActivityDate: Date
  currentStreak: number
  longestStreak: number
}

/**
 * Пересчитывает серию после отметки прогресса «сегодня»:
 * - если активность была вчера — серия +1;
 * - если активность уже была сегодня — серия не меняется;
 * - иначе (пропуск дня или первая активность) — серия сбрасывается в 1.
 */
export function computeNextStreak(state: StreakStateInput): StreakStateOutput {
  const { lastActivityDate, longestStreak, today } = state

  if (!lastActivityDate) {
    return { lastActivityDate: today, currentStreak: 1, longestStreak: Math.max(1, longestStreak) }
  }

  const dayDiff = toUtcDay(today) - toUtcDay(lastActivityDate)

  let nextStreak: number
  if (dayDiff === 0) {
    // Активность уже зафиксирована сегодня — серия сохраняется.
    nextStreak = Math.max(1, state.currentStreak)
  } else if (dayDiff === 1) {
    nextStreak = state.currentStreak + 1
  } else {
    nextStreak = 1
  }

  return {
    lastActivityDate: today,
    currentStreak: nextStreak,
    longestStreak: Math.max(longestStreak, nextStreak),
  }
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface AchievementStats {
  /** Пройдено узлов всего по всем деревьям. */
  totalCompletedNodes: number
  /** В проверяемом дереве завершены ВСЕ узлы. */
  isTreeFullyCompleted: boolean
  /** Создано собственных деревьев. */
  ownTreesCount: number
  /** Максимум узлов в одном собственном дереве. */
  maxNodesInOwnTree: number
  /** Есть собственное дерево с 10+ ациклическими рёбрами. */
  hasOwnTreeWith10PlusEdges: boolean
  /** Текущая серия дней. */
  currentStreak: number
  /** Сколько разных деревьев затронуто пройденными узлами. */
  distinctTreesStarted: number
  /** Оставлено комментариев. */
  commentsWritten: number
  /** Лайков на собственных деревьях. */
  likesReceived: number
  /** Сколько деревьев пройдено полностью. */
  fullyCompletedTrees: number
  /** Час (UTC) последней отметки прогресса — для ночной совы. */
  lastProgressHourUtc: number | null
}

const MARATHON_NODES_THRESHOLD = 20
const CENTURION_NODES_THRESHOLD = 100
const STREAK_WEEK_DAYS = 7
const EXPLORER_TREES_THRESHOLD = 5
const VOICE_COMMENTS_THRESHOLD = 3
const FAVORITE_LIKES_THRESHOLD = 5
const CURATOR_TREES_THRESHOLD = 3
const PERFECTIONIST_TREES_THRESHOLD = 3

/** Ночная сова: час в UTC попадает в ночной диапазон 22:00–05:59. */
function isNightHour(hour: number): boolean {
  return hour >= 22 || hour < 6
}

/**
 * Возвращает коды достижений, которые должны быть выданы по текущей статистике.
 * Отфильтровать уже выданные — задача вызывающей стороны.
 */
export function computeEarnedAchievementCodes(stats: AchievementStats): AchievementCode[] {
  const earned: AchievementCode[] = []

  if (stats.totalCompletedNodes >= 1) earned.push(ACHIEVEMENT_CODES.FIRST_STEPS)
  if (stats.isTreeFullyCompleted && stats.totalCompletedNodes >= 1) {
    earned.push(ACHIEVEMENT_CODES.TREE_COMPLETED)
  }
  if (stats.totalCompletedNodes >= MARATHON_NODES_THRESHOLD) earned.push(ACHIEVEMENT_CODES.MARATHON)
  if (stats.ownTreesCount >= 1 && stats.maxNodesInOwnTree >= 5) earned.push(ACHIEVEMENT_CODES.CREATOR)
  if (stats.hasOwnTreeWith10PlusEdges) earned.push(ACHIEVEMENT_CODES.CONNECTOR)
  if (stats.currentStreak >= STREAK_WEEK_DAYS) earned.push(ACHIEVEMENT_CODES.STREAK_WEEK)
  if (stats.distinctTreesStarted >= EXPLORER_TREES_THRESHOLD) earned.push(ACHIEVEMENT_CODES.EXPLORER)
  if (stats.commentsWritten >= VOICE_COMMENTS_THRESHOLD) earned.push(ACHIEVEMENT_CODES.VOICE)
  if (stats.likesReceived >= FAVORITE_LIKES_THRESHOLD) earned.push(ACHIEVEMENT_CODES.FAVORITE)
  if (stats.ownTreesCount >= CURATOR_TREES_THRESHOLD) earned.push(ACHIEVEMENT_CODES.CURATOR)
  if (stats.totalCompletedNodes >= CENTURION_NODES_THRESHOLD) earned.push(ACHIEVEMENT_CODES.CENTURION)
  if (
    stats.lastProgressHourUtc !== null &&
    isNightHour(stats.lastProgressHourUtc) &&
    stats.totalCompletedNodes >= 1
  ) {
    earned.push(ACHIEVEMENT_CODES.NIGHT_OWL)
  }
  if (stats.fullyCompletedTrees >= PERFECTIONIST_TREES_THRESHOLD) {
    earned.push(ACHIEVEMENT_CODES.PERFECTIONIST)
  }

  return earned
}

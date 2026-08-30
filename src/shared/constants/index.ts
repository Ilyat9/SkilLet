export const NODE_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  DONE: 'done',
} as const

export type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS]

/**
 * ЕДИНСТВЕННЫЙ источник правды для вида узла дерева.
 * color/textColor — семантические Tailwind-классы, привязанные к дизайн-токенам
 * темы (см. src/app/globals.css). Иконка — исторический астрономический/
 * алхимический символ (☿ процесс, ☉ завершение): это открытый символьный язык
 * манускриптов, а не игровая иконография (никаких щитов/замков). Заблокированный
 * узел без иконки — он «ещё не нанесён на карту» (пунктир, см. color).
 * label — человекочитаемое название статуса для aria-label и легенды.
 * SkillNode, CustomNode и легенда в SkillTreeViewer берут значения только отсюда.
 */
export const NODE_STATUS_CONFIG: Record<
  NodeStatus,
  { color: string; textColor: string; icon: string; label: string; overlay: string }
> = {
  [NODE_STATUS.LOCKED]: {
    color: 'border-border border-dashed bg-card',
    textColor: 'text-muted-foreground',
    icon: '',
    label: 'заблокирован',
    overlay: '',
  },
  [NODE_STATUS.AVAILABLE]: {
    color: 'border-accent bg-card',
    textColor: 'text-accent-strong',
    icon: '☿',
    label: 'доступен',
    overlay: '',
  },
  [NODE_STATUS.DONE]: {
    color: 'border-success bg-card',
    textColor: 'text-success',
    icon: '☉',
    label: 'пройден',
    overlay: 'bg-success/10',
  },
}

/** Порядок статусов для легенды и перебора. */
export const NODE_STATUS_ORDER: readonly NodeStatus[] = [
  NODE_STATUS.LOCKED,
  NODE_STATUS.AVAILABLE,
  NODE_STATUS.DONE,
]

/** Максимальное число узлов в одном дереве (защита от аномальных нагрузок на БД/UI). */
export const MAX_NODES_PER_TREE = 100

/** Максимальное число связей в одном дереве (лимит импорта/шаблона). */
export const MAX_EDGES_PER_TREE = 400

/** Границы координат узлов — должны совпадать с ограничениями NodeSchema (zod). */
export const NODE_POSITION_LIMIT = 3000

/**
 * Категории деревьев (Prisma enum TreeCategory). ЕДИНСТВЕННЫЙ источник списка:
 * zod-схемы, фильтр каталога и UI выбора категории берут значения отсюда.
 * Расширение списка — правка enum в prisma/schema.prisma + миграция
 * (ALTER TYPE ADD VALUE), затем эта константа.
 */
export const TREE_CATEGORIES = [
  'FRONTEND',
  'BACKEND',
  'DATA_SCIENCE',
  'SOFT_SKILLS',
  'DESIGN',
  'LANGUAGES',
  'OTHER',
] as const

export type TreeCategoryValue = (typeof TREE_CATEGORIES)[number]

/** Человекочитаемые подписи категорий для UI (бейджи, фильтры каталога). */
export const TREE_CATEGORY_LABELS: Record<TreeCategoryValue, string> = {
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATA_SCIENCE: 'Data Science / ML',
  SOFT_SKILLS: 'Soft Skills',
  DESIGN: 'Design',
  LANGUAGES: 'Иностранные языки',
  OTHER: 'Другое',
}

export interface AiDurationOption {
  id: string
  /** Подпись для селектора срока обучения в UI. */
  label: string
  /** Формулировка срока для промпта LLM («рассчитан на ~X недель»). */
  weeksLabel: string
  /** Границы количества узлов дерева, которые запрашиваются у модели под этот срок. */
  minNodes: number
  maxNodes: number
}

/**
 * Пресеты срока обучения для AI-генерации: чем длиннее срок — тем больше узлов
 * просит промпт у модели. Границы откалиброваны по живому прогону бесплатных
 * моделей OpenRouter (2026-08-30): деревья до ~30 узлов рабочая модель
 * (minimax-m3:free) собирала за 1–20с без проблем, поэтому нижние сроки
 * подняты выше дефолта, что был до этой фичи (8–20). Верхняя граница (45)
 * остаётся консервативной: там же на дереве в ~38 узлов при нагрузке ответ
 * занимал 15–58с — то есть top-уровень уже балансирует на грани таймаута
 * одного запроса, и лучше не толкать выше. Единственный источник границ —
 * эта константа: правь только тут.
 */
export const AI_DURATION_OPTIONS: readonly AiDurationOption[] = [
  { id: 'short', label: '1–2 недели', weeksLabel: '1–2 недели', minNodes: 10, maxNodes: 20 },
  { id: 'month', label: '1 месяц', weeksLabel: 'около 4 недель', minNodes: 16, maxNodes: 24 },
  { id: 'quarter', label: '3 месяца', weeksLabel: 'около 12 недель', minNodes: 22, maxNodes: 32 },
  { id: 'half_year', label: '6 месяцев', weeksLabel: 'около 24 недель', minNodes: 28, maxNodes: 38 },
  { id: 'year', label: '1 год и более', weeksLabel: 'год и более', minNodes: 34, maxNodes: 45 },
] as const

export type AiDurationId = (typeof AI_DURATION_OPTIONS)[number]['id']

/** Дефолт совпадает по духу со старым диапазоном 8–20, но чуть выше нижней планки. */
export const DEFAULT_AI_DURATION_ID: AiDurationId = 'month'

/** Готовый объект дефолтного срока — чтобы вызывающему коду не нужно было руками ловить undefined от .find(). */
export const DEFAULT_AI_DURATION_OPTION: AiDurationOption = (() => {
  const found = AI_DURATION_OPTIONS.find((option) => option.id === DEFAULT_AI_DURATION_ID)
  if (!found) throw new Error('DEFAULT_AI_DURATION_ID не найден в AI_DURATION_OPTIONS')
  return found
})()


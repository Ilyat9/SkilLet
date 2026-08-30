export const NODE_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  DONE: 'done',
} as const

export type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS]

/**
 * ЕДИНСТВЕННЫЙ источник правды для вида узла дерева.
 * color/textColor — семантические Tailwind-классы, привязанные к дизайн-токенам
 * темы (см. src/app/globals.css). Иконка — эмодзи-символ, одинаково читаемый
 * в обеих темах; label — человекочитаемое название статуса для aria-label и легенды.
 * SkillNode, CustomNode и легенда в SkillTreeViewer берут значения только отсюда.
 */
export const NODE_STATUS_CONFIG: Record<
  NodeStatus,
  { color: string; textColor: string; icon: string; label: string; overlay: string }
> = {
  [NODE_STATUS.LOCKED]: {
    color: 'border-border bg-card',
    textColor: 'text-muted-foreground',
    icon: '🔒',
    label: 'заблокирован',
    overlay: 'bg-muted/30',
  },
  [NODE_STATUS.AVAILABLE]: {
    color: 'border-accent bg-card',
    textColor: 'text-accent-strong',
    icon: '⚡',
    label: 'доступен',
    overlay: '',
  },
  [NODE_STATUS.DONE]: {
    color: 'border-success bg-card',
    textColor: 'text-success',
    icon: '✓',
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
  'DEVOPS',
  'DATA_SCIENCE',
  'SOFT_SKILLS',
  'DESIGN',
  'OTHER',
] as const

export type TreeCategoryValue = (typeof TREE_CATEGORIES)[number]

/** Человекочитаемые подписи категорий для UI (бейджи, фильтры каталога). */
export const TREE_CATEGORY_LABELS: Record<TreeCategoryValue, string> = {
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DEVOPS: 'DevOps',
  DATA_SCIENCE: 'Data Science',
  SOFT_SKILLS: 'Soft Skills',
  DESIGN: 'Design',
  OTHER: 'Другое',
}


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
  { color: string; textColor: string; icon: string; label: string }
> = {
  [NODE_STATUS.LOCKED]: {
    color: 'border-border bg-muted/40',
    textColor: 'text-muted-foreground',
    icon: '🔒',
    label: 'заблокирован',
  },
  [NODE_STATUS.AVAILABLE]: {
    color: 'border-accent bg-card/60',
    textColor: 'text-accent-strong',
    icon: '⚡',
    label: 'доступен',
  },
  [NODE_STATUS.DONE]: {
    color: 'border-success bg-success/10',
    textColor: 'text-success',
    icon: '✓',
    label: 'пройден',
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

/** Границы координат узлов — должны совпадать с ограничениями NodeSchema (zod). */
export const NODE_POSITION_LIMIT = 1000


export const NODE_STATUS = {
  LOCKED: 'locked',
  AVAILABLE: 'available',
  DONE: 'done',
} as const

export type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS]

export const NODE_STATUS_CONFIG = {
  [NODE_STATUS.LOCKED]: {
    color: 'border-gray-600 bg-gray-900',
    textColor: 'text-gray-400',
    icon: '🔒',
  },
  [NODE_STATUS.AVAILABLE]: {
    color: 'border-yellow-500 bg-gray-800',
    textColor: 'text-yellow-400',
    icon: '⚡',
  },
  [NODE_STATUS.DONE]: {
    color: 'border-green-500 bg-gray-800',
    textColor: 'text-green-400',
    icon: '✓',
  },
} as const

export const PROGRESS_BAR_COLORS = {
  [NODE_STATUS.LOCKED]: 'bg-gray-600',
  [NODE_STATUS.AVAILABLE]: 'bg-yellow-500',
  [NODE_STATUS.DONE]: 'bg-green-500',
} as const

'use client'

import { Node } from '../model/types'
import { Badge } from '@/shared/ui/Badge'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { NODE_STATUS, NodeStatus } from '@/shared/constants'
import { Lock, Unlock, CheckCircle2, ExternalLink } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface SkillNodeProps {
  node: Node
  status: NodeStatus
  isInteractive?: boolean
  onNodeClick?: () => void
  onResourceClick?: (e: React.MouseEvent) => void
}

export function SkillNode({ node, status, isInteractive = false, onNodeClick, onResourceClick }: SkillNodeProps) {
  const statusConfig = {
    [NODE_STATUS.LOCKED]: {
      color: 'border-gray-600 bg-gray-900',
      textColor: 'text-gray-400',
      icon: Lock,
    },
    [NODE_STATUS.AVAILABLE]: {
      color: 'border-yellow-500 bg-gray-800',
      textColor: 'text-yellow-400',
      icon: Unlock,
    },
    [NODE_STATUS.DONE]: {
      color: 'border-green-500 bg-gray-800',
      textColor: 'text-green-400',
      icon: CheckCircle2,
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'relative w-56 p-4 border-2 rounded-lg shadow-lg cursor-pointer',
        config.color,
        {
          'hover:border-yellow-400 transition-colors': isInteractive,
          'pointer-events-none': !isInteractive,
        }
      )}
      onClick={onNodeClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-5 h-5', config.textColor)} />
        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{node.title}</h4>
      </div>

      {node.description && (
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">
          {node.description}
        </p>
      )}

      {status !== NODE_STATUS.LOCKED && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">Сложность: {node.difficulty}/10</span>
          </div>
          <ProgressBar value={node.difficulty * 10} max={100} size="sm" />
        </div>
      )}

      {node.resources.length > 0 && status !== NODE_STATUS.LOCKED && (
        <button
          onClick={onResourceClick}
          className={cn(
            'flex items-center justify-center gap-1 text-xs',
            'bg-primary/10 text-primary hover:bg-primary/20',
            'px-3 py-1.5 rounded transition-colors w-full'
          )}
        >
          <ExternalLink className="w-3 h-3" />
          Материалы
        </button>
      )}
    </div>
  )
}

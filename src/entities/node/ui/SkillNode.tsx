'use client'

import { Node } from '../model/types'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { NODE_STATUS_CONFIG, NODE_STATUS, NodeStatus } from '@/shared/constants'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface SkillNodeProps {
  node: Node
  status: NodeStatus
  isInteractive?: boolean
  onNodeClick?: (() => void) | undefined
  onResourceClick?: ((e: React.MouseEvent) => void) | undefined
}

export function SkillNode({ node, status, isInteractive = false, onNodeClick, onResourceClick }: SkillNodeProps) {
  const config = NODE_STATUS_CONFIG[status]

  return (
    <div
      className={cn(
        'relative w-56 p-4 border-2 rounded-lg shadow-lg cursor-pointer',
        config.color,
        {
          'hover:border-accent-strong transition-colors': isInteractive,
          'pointer-events-none': !isInteractive,
        }
      )}
      onClick={onNodeClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-base leading-none', config.textColor)} aria-hidden>
          {config.icon}
        </span>
        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{node.title}</h4>
      </div>

      {node.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {node.description}
        </p>
      )}

      {status !== NODE_STATUS.LOCKED && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Сложность: {node.difficulty}/10</span>
          </div>
          <ProgressBar value={node.difficulty * 10} max={100} size="sm" ariaLabel={`Сложность навыка «${node.title}»`} />
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

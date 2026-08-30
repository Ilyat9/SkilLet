'use client'

import { Node } from '../model/types'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { NODE_STATUS_CONFIG, NODE_STATUS, NodeStatus } from '@/shared/constants'
import { cn } from '@/shared/lib/utils'

interface SkillNodeProps {
  node: Node
  status: NodeStatus
  isInteractive?: boolean
  /** Узел выбран на графе — заметная подсветка (детали открываются в сайдбаре). */
  isSelected?: boolean
  onNodeClick?: (() => void) | undefined
}

export function SkillNode({ node, status, isInteractive = false, isSelected = false, onNodeClick }: SkillNodeProps) {
  const config = NODE_STATUS_CONFIG[status]

  // Enter/Space активируют узел с клавиатуры так же, как клик мышью.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive || !onNodeClick) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      onNodeClick()
    }
  }

  return (
    <div
      className={cn(
        'relative w-56 p-4 border-2 rounded-lg shadow-lg cursor-pointer',
        config.color,
        {
          'hover:border-accent-strong transition-colors': isInteractive,
          'ring-2 ring-primary ring-offset-2 ring-offset-background': isSelected,
          'pointer-events-none': !isInteractive,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background':
            isInteractive,
        }
      )}
      onClick={onNodeClick}
      onKeyDown={handleKeyDown}
      {...(isInteractive
        ? { role: 'button', tabIndex: 0 }
        : { role: 'button', tabIndex: -1 })}
      aria-label={`Навык «${node.title}», статус: ${config.label}`}
      aria-disabled={!isInteractive}
    >
      {/* Непрозрачная подложка + статусный тинт поверх: рёбра графа не просвечивают. */}
      {config.overlay !== '' && (
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 rounded-md', config.overlay)} />
      )}
      <div className="relative flex items-center gap-2 mb-2">
        <span className={cn('text-base leading-none', config.textColor)} aria-hidden>
          {config.icon}
        </span>
        <h4 className="font-semibold text-sm text-foreground line-clamp-1">{node.title}</h4>
      </div>

      {node.description && (
        <p className="relative text-xs text-muted-foreground mb-3 line-clamp-2">
          {node.description}
        </p>
      )}

      {status !== NODE_STATUS.LOCKED && (
        <div className="relative mb-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Сложность: {node.difficulty}/10</span>
          </div>
          <ProgressBar value={node.difficulty * 10} max={100} size="sm" ariaLabel={`Сложность навыка «${node.title}»`} />
        </div>
      )}
    </div>
  )
}

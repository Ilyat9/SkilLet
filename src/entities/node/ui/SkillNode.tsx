'use client'

import { Node } from '../model/types'
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

/**
 * Сложность как «растущая тень штриховки» слева направо — карта дорисовывается,
 * а не заполняется прогресс-полосой (полоса — самый дефолтный UI-паттерн).
 */
function DifficultyHatch({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(10, value))
  return (
    <div aria-hidden className="relative h-2.5 border border-border/70 overflow-hidden rounded-[2px]">
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${clamped * 10}%`,
          color: 'hsl(var(--accent-strong) / 0.85)',
          backgroundImage:
            'repeating-linear-gradient(135deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)',
        }}
      />
    </div>
  )
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
        // Тонкая рамка в один пиксель; радиус с ассиметричными углами —
        // «нарисовано от руки», не идеальная геометрия.
        'relative w-56 p-4 border shadow-sm',
        'rounded-[10px_13px_9px_12px]',
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
      aria-label={`Навык «${node.title}», статус: ${config.label}, сложность ${node.difficulty}/10`}
      aria-disabled={!isInteractive}
    >
      {/* Непрозрачная подложка + статусный тинт поверх: рёбра графа не просвечивают. */}
      {config.overlay !== '' && (
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 rounded-[10px_13px_9px_12px]', config.overlay)} />
      )}

      {/* Сложность — пометка-число в углу, как клеймо мастера. */}
      {status !== NODE_STATUS.LOCKED && (
        <span
          className="font-stamp absolute top-2 right-2.5 text-xs text-muted-foreground"
          aria-hidden
        >
          {node.difficulty}/10
        </span>
      )}

      <div className="relative flex items-start gap-2 mb-2 pr-8">
        {config.icon !== '' && (
          <span className={cn('text-base leading-none pt-0.5', config.textColor)} aria-hidden>
            {config.icon}
          </span>
        )}
        {/* line-clamp-2: длинные названия переносятся, а не обрубаются. */}
        <h4 className="font-semibold text-sm text-foreground line-clamp-2">{node.title}</h4>
      </div>

      {node.description && (
        <p className="relative text-xs text-muted-foreground mb-3 line-clamp-2">
          {node.description}
        </p>
      )}

      {status !== NODE_STATUS.LOCKED && (
        <div className="relative">
          <DifficultyHatch value={node.difficulty} />
        </div>
      )}
    </div>
  )
}

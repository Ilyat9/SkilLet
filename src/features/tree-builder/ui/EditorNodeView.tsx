'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FileText, Video } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Кастомный узел редактора дерева. Без него ReactFlow рисует дефолтные
 * белые прямоугольники без текста. Стили согласованы с SkillNode
 * (w-56 карточка, прогресс сложности), но без статусной логики:
 * в редакторе все узлы редактируемы, статусы не отображаются.
 */
export function EditorNodeView({ data, selected }: NodeProps) {
  const nodeData = data as {
    title: string
    description?: string | undefined
    difficulty: number
    resourceType?: 'video' | 'article' | undefined
  }

  return (
    <div
      className={cn(
        'relative w-56 p-4 border shadow-sm bg-card',
        'rounded-[10px_13px_9px_12px]',
        selected ? 'border-accent-strong ring-2 ring-accent/40' : 'border-border'
      )}
      aria-label={`Навык «${nodeData.title}»`}
    >
      {/* Сложность — пометка-число в углу (как на узлах дерева). */}
      <span className="font-stamp absolute top-2 right-2.5 text-xs text-muted-foreground" aria-hidden>
        {nodeData.difficulty}/10
      </span>
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-start gap-2 mb-2 pr-8">
        {nodeData.resourceType === 'video' ? (
          <Video className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
        ) : nodeData.resourceType === 'article' ? (
          <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
        ) : null}
        <h4 className="font-semibold text-sm text-foreground line-clamp-2">{nodeData.title}</h4>
      </div>

      {nodeData.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{nodeData.description}</p>
      )}

      {/* Штриховка сложности слева направо — как на узлах дерева просмотра. */}
      <div aria-hidden className="relative h-2.5 border border-border/70 overflow-hidden rounded-[2px]">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(100, nodeData.difficulty * 10))}%`,
            color: 'hsl(var(--accent-strong) / 0.85)',
            backgroundImage:
              'repeating-linear-gradient(135deg, currentColor 0, currentColor 1px, transparent 1px, transparent 4px)',
          }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
}

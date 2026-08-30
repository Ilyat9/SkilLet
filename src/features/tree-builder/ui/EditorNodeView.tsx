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
        'relative w-56 p-4 border-2 rounded-lg shadow-lg bg-card',
        selected ? 'border-accent-strong ring-2 ring-accent/40' : 'border-border'
      )}
      aria-label={`Навык «${nodeData.title}»`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <div className="flex items-center gap-2 mb-2">
        {nodeData.resourceType === 'video' ? (
          <Video className="w-4 h-4 text-primary shrink-0" aria-hidden />
        ) : nodeData.resourceType === 'article' ? (
          <FileText className="w-4 h-4 text-primary shrink-0" aria-hidden />
        ) : null}
        <h4 className="font-semibold text-sm text-foreground line-clamp-2">{nodeData.title}</h4>
      </div>

      {nodeData.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{nodeData.description}</p>
      )}

      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">Сложность: {nodeData.difficulty}/10</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.max(0, Math.min(100, nodeData.difficulty * 10))}%` }}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  )
}

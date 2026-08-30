'use client'

import { X, BookOpen } from 'lucide-react'
import { type Node, type NodeProps } from '@xyflow/react'
import { MarkCompleteButton } from '@/features/progress-tracker/ui/MarkCompleteButton'
import type { Node as AppNode } from '@/entities/node/model/types'
import type { NodeStatus } from '@/shared/constants'

/**
 * Данные узла-карточки навыка (раскрывается под выбранным узлом графа).
 * type, а не interface — см. комментарий к CustomNodeData (constraint RF v12).
 */
export type DetailsNodeData = {
  node: AppNode
  completedNodeIds: Set<string>
  status: NodeStatus
  isCompleted: boolean
  blockedByTitle: string | null
  unlockHint: string | null
  onToggle: (completed: boolean) => void
  onClose: () => void
}

export type DetailsFlowNode = Node<DetailsNodeData, 'details'>

export function DetailsNode({ data }: NodeProps<DetailsFlowNode>) {
  const { node, completedNodeIds, isCompleted, blockedByTitle, unlockHint } = data

  return (
    <div className="w-56 bg-card border-2 border-primary rounded-lg shadow-xl p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm leading-snug">{node.title}</h4>
        <button
          onClick={data.onClose}
          aria-label="Закрыть карточку навыка"
          className="p-0.5 rounded hover:bg-secondary shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </div>

      <div className="text-xs text-muted-foreground mt-0.5">Сложность: {node.difficulty}/10</div>

      {node.description && <p className="text-xs text-muted-foreground mt-2">{node.description}</p>}

      {node.resources.length > 0 && (
        <div className="mt-2.5">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            <BookOpen className="w-3 h-3" aria-hidden />
            Материалы для прохождения
          </div>
          <ul className="space-y-1">
            {node.resources.slice(0, 4).map((resource) => (
              <li key={resource.url}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline break-words"
                >
                  {resource.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2.5">
        <MarkCompleteButton
          node={node}
          completedNodeIds={completedNodeIds}
          isCompleted={isCompleted}
          blockedByTitle={blockedByTitle}
          onToggle={data.onToggle}
        />
      </div>

      {unlockHint && <p className="text-xs text-muted-foreground mt-1.5">{unlockHint}</p>}
    </div>
  )
}

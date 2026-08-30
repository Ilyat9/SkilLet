'use client'

import { X, BookOpen } from 'lucide-react'
import { MarkCompleteButton } from '@/features/progress-tracker/ui/MarkCompleteButton'
import type { Node as AppNode } from '@/entities/node/model/types'
import type { NodeStatus } from '@/shared/constants'

/**
 * Карточка выбранного навыка в правом сайдбаре: описание, материалы,
 * отметка пройденным. Граф при выборе узла только подсвечивает его.
 */
export interface NodeDetailsCardProps {
  node: AppNode
  status: NodeStatus
  completedNodeIds: Set<string>
  isCompleted: boolean
  blockedByTitle: string | null
  unlockHint: string | null
  onToggle: (completed: boolean) => void
  onClose: () => void
}

export function NodeDetailsCard({
  node,
  completedNodeIds,
  isCompleted,
  blockedByTitle,
  unlockHint,
  onToggle,
  onClose,
}: NodeDetailsCardProps) {
  return (
    <div className="bg-card border-2 border-primary rounded-lg shadow-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-sm leading-snug">{node.title}</h3>
        <button
          onClick={onClose}
          aria-label="Закрыть карточку навыка"
          className="p-0.5 rounded hover:bg-secondary shrink-0"
        >
          <X className="w-4 h-4" aria-hidden />
        </button>
      </div>

      <div className="text-xs text-muted-foreground mt-1">Сложность: {node.difficulty}/10</div>

      {node.description && <p className="text-xs text-muted-foreground mt-2">{node.description}</p>}

      {node.resources.length > 0 ? (
        <div className="mt-3">
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1.5">
            <BookOpen className="w-3.5 h-3.5" aria-hidden />
            Материалы для прохождения
          </div>
          <ul className="space-y-1.5">
            {node.resources.map((resource) => (
              <li key={resource.url}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline break-words"
                >
                  {resource.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mt-3">Материалы к навыку пока не добавлены.</p>
      )}

      <div className="mt-3">
        <MarkCompleteButton
          node={node}
          completedNodeIds={completedNodeIds}
          isCompleted={isCompleted}
          blockedByTitle={blockedByTitle}
          onToggle={onToggle}
        />
      </div>

      {unlockHint && <p className="text-xs text-muted-foreground mt-2">{unlockHint}</p>}
    </div>
  )
}

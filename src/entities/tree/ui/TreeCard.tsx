'use client'

import { Tree } from '../model/types'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'
import { Lock, Unlock, User } from 'lucide-react'

interface TreeCardProps {
  tree: Tree
  isPublic: boolean
  onExplore?: () => void
  onSelect?: () => void
}

export function TreeCard({ tree, isPublic, onExplore, onSelect }: TreeCardProps) {
  const action = onSelect ?? onExplore

  // Enter/Space активируют карточку с клавиатуры так же, как клик.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!action) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        {
          'cursor-pointer': Boolean(action),
          'cursor-default': !action,
        }
      )}
      onClick={action}
      onKeyDown={handleKeyDown}
      {...(action ? { role: 'button', tabIndex: 0 } : {})}
      aria-label={`Дерево «${tree.title}»${tree._count?.nodes ? `, ${tree._count.nodes} навыков` : ''}${isPublic ? ', публичное' : ', приватное'}`}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">{tree.title}</h3>
        {tree.author && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <span>{tree.author.name || 'Unknown'}</span>
          </div>
        )}
      </div>

      {tree.description && (
        <p className="text-muted-foreground mb-4 text-sm line-clamp-2">
          {tree.description}
        </p>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {isPublic ? (
          <Badge variant="success">Публичное</Badge>
        ) : (
          <Badge variant="warning">Приватное</Badge>
        )}
        <span className="text-text-tertiary text-sm">
          {tree._count?.nodes || 0} навыков
        </span>
        {(tree._count?.progresses ?? 0) > 0 && (
          <span className="text-warning text-sm flex items-center gap-1" title="Сколько раз узлы дерева отмечены пройденными">
            🔥 {tree._count?.progresses}
          </span>
        )}
      </div>

      {onSelect && (
        <div className="flex justify-end">
          <Badge variant="default" className="opacity-0 group-hover:opacity-100 transition-opacity">
            {isPublic ? (
              <>
                <Unlock className="w-3 h-3 mr-1" />
                Открыть
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 mr-1" />
                Открыть
              </>
            )}
          </Badge>
        </div>
      )}
    </div>
  )
}

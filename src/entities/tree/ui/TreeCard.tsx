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
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors group',
        {
          'cursor-pointer': onSelect || onExplore,
          'cursor-default': !onSelect && !onExplore,
        }
      )}
      onClick={onSelect || onExplore}
    >
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xl font-semibold text-foreground">{tree.title}</h3>
        {tree.author && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User className="w-4 h-4" />
            <span>{tree.author.name || 'Unknown'}</span>
          </div>
        )}
      </div>

      {tree.description && (
        <p className="text-gray-400 mb-4 text-sm line-clamp-2">
          {tree.description}
        </p>
      )}

      <div className="flex items-center gap-3 mb-4">
        {isPublic ? (
          <Badge variant="success">Публичное</Badge>
        ) : (
          <Badge variant="warning">Приватное</Badge>
        )}
        <span className="text-gray-500 text-sm">
          {tree._count?.nodes || 0} навыков
        </span>
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

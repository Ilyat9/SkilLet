'use client'

import { Tree } from '../model/types'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/utils'
import { TREE_CATEGORY_LABELS } from '@/shared/constants'
import { Lock, Unlock, User, Heart, Flame } from 'lucide-react'

interface TreeCardProps {
  tree: Tree
  isPublic: boolean
  onExplore?: () => void
  onSelect?: () => void
  /** Лайк-тоггл: только в каталоге публичных деревьев (на своих карточках смысла нет). */
  onToggleLike?: (tree: Tree) => void
  /** Пользователь авторизован? (неавторизованный клик по лайку → редирект на вход). */
  canLike?: boolean
}

export function TreeCard({ tree, isPublic, onExplore, onSelect, onToggleLike, canLike = false }: TreeCardProps) {
  const action = onSelect ?? onExplore

  // Enter/Space активируют карточку с клавиатуры так же, как клик.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!action) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  const handleLikeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Лайк-кнопка внутри «карточки-кнопки»: Enter/Space не должны открыть дерево.
    if (event.key === 'Enter' || event.key === ' ') {
      event.stopPropagation()
    }
  }

  const handleLike = (event: React.MouseEvent) => {
    // Клик по сердцу не открывает карточку-ссылку.
    event.stopPropagation()
    if (!onToggleLike || !canLike) return
    onToggleLike(tree)
  }

  const likeLabel = tree.likedByMe
    ? `Убрать лайк с дерева «${tree.title}»`
    : `Поставить лайк дереву «${tree.title}»`

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
        {/* Категория — основа «умной фильтрации» каталога. */}
        {tree.category && (
          <Badge variant="default">{TREE_CATEGORY_LABELS[tree.category]}</Badge>
        )}
        <span className="text-text-tertiary text-sm">
          {tree._count?.nodes || 0} навыков
        </span>
        {(tree._count?.progresses ?? 0) > 0 && (
          <span className="text-warning text-sm flex items-center gap-1" title="Сколько раз узлы дерева отмечены пройденными">
            <Flame className="w-4 h-4" aria-hidden />
            <span className="font-stamp">{tree._count?.progresses}</span>
          </span>
        )}
        {/* Сложность: средняя по узлам (агрегат приходит из GET /api/trees). */}
        {tree.difficultyStats && tree.difficultyStats.max > 0 && (
          <span
            className="text-text-tertiary text-sm"
            title={`Сложность узлов: от ${tree.difficultyStats.min} до ${tree.difficultyStats.max}`}
          >
            ★ ~{tree.difficultyStats.avg}
          </span>
        )}
        {/* Лайк: счётчик + кнопка-тоггл (только в каталоге сообщества). */}
        {onToggleLike && (
          canLike ? (
            <button
              type="button"
              onClick={handleLike}
              onKeyDown={handleLikeKeyDown}
              aria-pressed={Boolean(tree.likedByMe)}
              aria-label={likeLabel}
              className={cn(
                'ml-auto flex items-center gap-1 px-2 py-1 rounded-md border text-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                tree.likedByMe
                  ? 'border-destructive text-destructive bg-destructive/10'
                  : 'border-border text-muted-foreground hover:text-destructive hover:border-destructive/50'
              )}
            >
              <Heart className={cn('w-4 h-4', tree.likedByMe && 'fill-current')} aria-hidden />
              {tree._count?.likes ?? 0}
            </button>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-sm text-muted-foreground" title="Лайки сообщества">
              <Heart className="w-4 h-4" aria-hidden />
              {tree._count?.likes ?? 0}
            </span>
          )
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

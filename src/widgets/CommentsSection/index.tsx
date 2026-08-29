'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { useToast } from '@/shared/ui/Toast'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { MessageSquare, Loader2, Trash2, SendHorizontal } from 'lucide-react'

interface CommentAuthor {
  id: string
  name: string | null
  image: string | null
}

export interface TreeComment {
  id: string
  body: string
  createdAt: string
  authorId: string
  author: CommentAuthor
}

interface CommentsPage {
  items: TreeComment[]
  page: number
  limit: number
  total: number
  totalPages: number
  treeAuthorId: string
}

const PAGE_SIZE = 20

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Секция комментариев под просмотром дерева: плоский список (без тредов —
 * осознанное решение для этого масштаба), пагинация «Показать ещё»,
 * добавление и удаление (свои комментарии; владелец дерева может удалять
 * любые — модерация).
 */
export function CommentsSection({ treeId, treeAuthorId }: { treeId: string; treeAuthorId: string }) {
  const { data: session, status } = useAuth()
  const { showToast } = useToast()

  const [comments, setComments] = useState<TreeComment[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchComments = useCallback(
    async (targetPage: number, append: boolean) => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const response = await fetch(`/api/trees/${treeId}/comments?page=${targetPage}&limit=${PAGE_SIZE}`)
        const result = await response.json()
        if (result.error) {
          setLoadError(result.error.message ?? 'Не удалось загрузить комментарии')
          return
        }
        const data = result.data as CommentsPage
        setComments((prev) => (append ? [...prev, ...data.items] : data.items))
        setTotal(data.total)
        setTotalPages(data.totalPages)
        setPage(targetPage)
      } catch (err) {
        console.error('Ошибка загрузки комментариев:', err)
        setLoadError('Не удалось загрузить комментарии')
      } finally {
        setIsLoading(false)
      }
    },
    [treeId]
  )

  useEffect(() => {
    void fetchComments(1, false)
  }, [fetchComments])

  const canModerate = Boolean(session?.user?.id && session.user.id === treeAuthorId)
  const currentUserId = session?.user?.id

  const canDelete = (comment: TreeComment): boolean =>
    canModerate || Boolean(currentUserId && comment.authorId === currentUserId)

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/trees/${treeId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed }),
      })
      const result = await response.json()
      if (result.error) {
        showToast(result.error.message ?? 'Не удалось отправить комментарий', 'error')
        return
      }
      // Новый комментарий встаёт первым (список newest-first).
      setComments((prev) => [result.data as TreeComment, ...prev])
      setTotal((prev) => prev + 1)
      setBody('')
      showToast('Комментарий добавлен', 'success')
    } catch (err) {
      console.error('Ошибка отправки комментария:', err)
      showToast('Ошибка отправки комментария', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId)
    try {
      const response = await fetch(`/api/trees/${treeId}/comments/${commentId}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.error) {
        showToast(result.error.message ?? 'Не удалось удалить комментарий', 'error')
        return
      }
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
      setTotal((prev) => Math.max(0, prev - 1))
      showToast('Комментарий удалён', 'success')
    } catch (err) {
      console.error('Ошибка удаления комментария:', err)
      showToast('Ошибка удаления комментария', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  const isAuthenticated = status === 'authenticated'

  return (
    <section className="bg-card border border-border rounded-lg p-4 sm:p-6" aria-label="Комментарии к дереву">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5 text-primary" aria-hidden />
        <h2 className="text-lg font-semibold">Обсуждение</h2>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {total > 0 ? `· ${total}` : ''}
        </span>
      </div>

      {/* Форма добавления — только для авторизованных. */}
      {isAuthenticated ? (
        <div className="mb-6">
          <label htmlFor="comment-body" className="sr-only">
            Новый комментарий
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd+Enter отправляет комментарий, Enter переносит строку.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                void handleSubmit()
              }
            }}
            rows={3}
            maxLength={2000}
            placeholder="Поделитесь мнением об этом дереве…"
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-text-tertiary">{body.length}/2000 · Ctrl+Enter — отправить</span>
            <Button size="sm" onClick={() => void handleSubmit()} disabled={isSubmitting || !body.trim()}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <SendHorizontal className="w-4 h-4 mr-1" />}
              Отправить
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">
          Войдите, чтобы участвовать в обсуждении.
        </p>
      )}

      {/* Список комментариев. */}
      {isLoading && comments.length === 0 ? (
        <div role="status" aria-label="Загрузка комментариев" className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        <EmptyState icon={MessageSquare} title="Ошибка загрузки" description={loadError} />
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Комментариев пока нет"
          description="Станьте первым — расскажите, что думаете об этом дереве"
        />
      ) : (
        <>
          <ul className="space-y-4">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <div
                  className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-semibold shrink-0"
                  aria-hidden
                >
                  {(comment.author.name || '?').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{comment.author.name || 'Пользователь'}</span>
                    <time dateTime={comment.createdAt} className="text-xs text-text-tertiary">
                      {formatDate(comment.createdAt)}
                    </time>
                    {comment.authorId === treeAuthorId && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">автор дерева</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.body}</p>
                </div>
                {canDelete(comment) && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(comment.id)}
                    disabled={deletingId === comment.id}
                    aria-label={
                      canModerate && comment.authorId !== currentUserId
                        ? 'Удалить комментарий (модерация)'
                        : 'Удалить свой комментарий'
                    }
                    title={
                      canModerate && comment.authorId !== currentUserId
                        ? 'Удалить (модерация)'
                        : 'Удалить комментарий'
                    }
                    className="self-start p-1 rounded text-text-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {deletingId === comment.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" aria-hidden />
                    )}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {page < totalPages && (
            <div className="flex justify-center mt-6">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void fetchComments(page + 1, true)}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                Показать ещё
                {totalPages > 1 ? ` (${page}/${totalPages})` : ''}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
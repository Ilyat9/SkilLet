'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { Button } from '@/shared/ui/Button'
import { TreeCard } from '@/entities/tree/ui/TreeCard'
import { TreeWithRelations } from '@/entities/tree/model/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Lock } from 'lucide-react'
import { EmptyState } from '@/shared/ui/EmptyState'

export default function DashboardPage() {
  const { data: session, status } = useAuth()
  const router = useRouter()
  const [trees, setTrees] = useState<TreeWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  // Онбординг новых пользователей: если собственных деревьев нет, дашборд
  // показывает рекомендованные публичные деревья сообщества (README: после
  // входа пользователь сразу видит готовые деревья для изучения).
  const [recommended, setRecommended] = useState<TreeWithRelations[]>([])
  const [recommendedError, setRecommendedError] = useState<string | null>(null)

  const fetchRecommended = useCallback(async () => {
    try {
      const response = await fetch('/api/trees?scope=public&sort=popular&limit=6')
      const result = await response.json()
      if (result.error) {
        setRecommendedError(result.error.message)
        return
      }
      setRecommended(result.data?.items ?? [])
    } catch (error) {
      console.error('Ошибка загрузки рекомендованных деревьев:', error)
      setRecommendedError('Не удалось загрузить рекомендованные деревья')
    }
  }, [])

  const fetchTrees = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/trees?scope=mine')
      const result = await response.json()
      const items: TreeWithRelations[] = result.data?.items ?? []
      setTrees(items)
      if (items.length === 0) {
        void fetchRecommended()
      }
    } catch (error) {
      console.error('Ошибка загрузки деревьев:', error)
    } finally {
      setIsLoading(false)
    }
  }, [fetchRecommended])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      void fetchTrees()
    }
  }, [status, router, fetchTrees])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" role="status" aria-label="Загрузка">
          <div className="space-y-2 mb-8">
            <div className="h-8 w-56 rounded bg-muted animate-pulse" />
            <div className="h-4 w-64 rounded bg-muted animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
                <div className="h-6 w-32 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Мои деревья</h1>
            <p className="text-muted-foreground">Управляйте вашими навыками</p>
          </div>
          <Button asChild>
            <Link href="/tree/new">
              <Plus className="w-5 h-5 mr-2" />
              Создать дерево
            </Link>
          </Button>
        </div>

        {isLoading ? (
          /* Skeleton вместо спиннера — согласован с dashboard/loading.tsx. */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Загрузка деревьев">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4 animate-pulse">
                <div className="flex items-start justify-between">
                  <div className="h-6 w-32 rounded bg-muted" />
                  <div className="h-4 w-20 rounded bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                </div>
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : trees.every((t) => (t._count?.nodes ?? 0) === 0) ? (
          <>
            {/* Онбординг: у нового пользователя нет своих деревьев — показываем
                готовые публичные деревья сообщества вместо пустого состояния. */}
            <EmptyState
              icon={Lock}
              title="У вас пока нет деревьев"
              description="Создайте первое дерево или начните с публичного дерева сообщества ниже"
              action={
                <Button asChild>
                  <Link href="/tree/new">
                    <Plus className="w-5 h-5 mr-2" />
                    Создать дерево
                  </Link>
                </Button>
              }
            />

            {recommendedError ? (
              <p className="text-sm text-muted-foreground text-center" role="alert">
                {recommendedError}
              </p>
            ) : recommended.length > 0 ? (
              <section aria-labelledby="recommended-heading" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 id="recommended-heading" className="text-xl font-semibold">
                      Рекомендуем начать отсюда
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Публичные деревья сообщества — открывайте и отмечайте прогресс
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => router.push('/explore')}>
                    Весь каталог →
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommended.map((tree) => (
                    <TreeCard
                      key={tree.id}
                      tree={tree}
                      isPublic
                      onSelect={() => router.push(`/tree/${tree.id}`)}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Деревья без узлов не рисуем карточками: среди заполненных они
                выглядят сломавшейся заглушкой (пустые — сид-артефакт или
                черновик без содержимого). Полностью пустой дашборд обслуживает
                ветка empty state выше. */}
            {trees
              .filter((t) => (t._count?.nodes ?? 0) > 0)
              .map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  isPublic={tree.isPublic}
                  onSelect={() => router.push(`/tree/${tree.id}`)}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

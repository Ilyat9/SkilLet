'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TreeCard } from '@/entities/tree/ui/TreeCard'
import type { Tree } from '@/entities/tree/model/types'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Search, Compass, AlertTriangle, SearchX, ChevronLeft, ChevronRight } from 'lucide-react'

type SortMode = 'newest' | 'popular'

interface TreesPage {
  items: Tree[]
  page: number
  limit: number
  total: number
  totalPages: number
}

const PAGE_SIZE = 20

export default function ExplorePage() {
  const router = useRouter()
  const [trees, setTrees] = useState<TreesPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('popular')
  const [page, setPage] = useState(1)

  // Поиск и сортировка выполняются на сервере (пагинация делает клиентский
  // фильтр по всем деревьям невозможным). Debounce 400мс на ввод.
  const fetchPublicTrees = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        scope: 'public',
        sort: sortMode,
        page: String(page),
        limit: String(PAGE_SIZE),
      })
      if (searchQuery.trim()) params.set('search', searchQuery.trim())

      const response = await fetch(`/api/trees?${params.toString()}`)
      const result = await response.json()
      if (result.error) {
        setError(result.error.message)
        return
      }
      setTrees(result.data as TreesPage)
    } catch (err) {
      console.error('Ошибка загрузки каталога:', err)
      setError('Не удалось загрузить публичные деревья')
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, sortMode, page])

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPublicTrees(), 400)
    return () => window.clearTimeout(timer)
  }, [fetchPublicTrees])

  const changeSort = (mode: SortMode) => {
    setSortMode(mode)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Каталог деревьев</h1>
            <p className="text-muted-foreground">Публичные skill-деревья сообщества</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/tree/new')}>
            Создать своё дерево
          </Button>
        </div>

        {/* Поиск и сортировка */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              placeholder="Поиск по названию или описанию…"
              className="w-full bg-card border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            {(
              [
                { id: 'popular', label: '🔥 По популярности' },
                { id: 'newest', label: '🕐 По дате' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => changeSort(option.id)}
                className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                  sortMode === option.id
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          /* Skeleton карточек вместо спиннера. */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="status" aria-label="Загрузка каталога">
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
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Ошибка загрузки" description={error} />
        ) : trees === null || trees.items.length === 0 ? (
          searchQuery ? (
            <EmptyState icon={SearchX} title="Ничего не найдено" description="Попробуйте изменить поисковый запрос" />
          ) : (
            <EmptyState
              icon={Compass}
              title="Пока нет публичных деревьев"
              description="Создайте первое дерево и поделитесь им с сообществом"
              action={<Button onClick={() => router.push('/tree/new')}>Создать дерево</Button>}
            />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trees.items.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  isPublic
                  onSelect={() => router.push(`/tree/${tree.id}`)}
                />
              ))}
            </div>

            {/* Пагинация: навигация видна только если страниц больше одной. */}
            {trees.totalPages > 1 && (
              <nav className="flex items-center justify-center gap-4 mt-10" aria-label="Постраничная навигация">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={trees.page <= 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Назад
                </Button>
                <span className="text-sm text-muted-foreground" aria-live="polite">
                  Страница {trees.page} из {trees.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(trees.totalPages, p + 1))}
                  disabled={trees.page >= trees.totalPages}
                >
                  Вперёд
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TreeCard } from '@/entities/tree/ui/TreeCard'
import type { Tree } from '@/entities/tree/model/types'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { useAuth } from '@/features/auth/ui/useAuth'
import { TREE_CATEGORIES, TREE_CATEGORY_LABELS, type TreeCategoryValue } from '@/shared/constants'
import { Search, Compass, AlertTriangle, SearchX, ChevronLeft, ChevronRight, Flame, Clock } from 'lucide-react'

type SortMode = 'newest' | 'popular'

interface TreesPage {
  items: Tree[]
  page: number
  limit: number
  total: number
  totalPages: number
}

const PAGE_SIZE = 20
const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 10

export default function ExplorePage() {
  const router = useRouter()
  const { status } = useAuth()
  const [trees, setTrees] = useState<TreesPage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('popular')
  const [page, setPage] = useState(1)
  // Умная фильтрация: категория + диапазон средней сложности дерева.
  const [category, setCategory] = useState<TreeCategoryValue | ''>('')
  const [minDifficulty, setMinDifficulty] = useState(DIFFICULTY_MIN)
  const [maxDifficulty, setMaxDifficulty] = useState(DIFFICULTY_MAX)

  // Поиск, сортировка и фильтры выполняются на сервере (пагинация делает
  // клиентский фильтр по всем деревьям невозможным). Debounce 400мс на ввод.
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
      if (category) params.set('category', category)
      // Фильтр сложности шлём только когда он сужает полный диапазон.
      if (minDifficulty > DIFFICULTY_MIN) params.set('minDifficulty', String(minDifficulty))
      if (maxDifficulty < DIFFICULTY_MAX) params.set('maxDifficulty', String(maxDifficulty))

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
  }, [searchQuery, sortMode, page, category, minDifficulty, maxDifficulty])

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchPublicTrees(), 400)
    return () => window.clearTimeout(timer)
  }, [fetchPublicTrees])

  const changeSort = (mode: SortMode) => {
    setSortMode(mode)
    setPage(1)
  }

  const changeCategory = (value: TreeCategoryValue | '') => {
    setCategory(value)
    setPage(1)
  }

  /** Оптимистичный тоггл лайка: счётчик и состояние меняются сразу, откат при ошибке. */
  const toggleLike = async (tree: Tree) => {
    if (status !== 'authenticated') {
      router.push('/login')
      return
    }
    const patchItem = (item: Tree, likedByMe: boolean, likes: number): Tree =>
      item.id === tree.id
        ? { ...item, likedByMe, _count: { nodes: item._count?.nodes ?? 0, progresses: item._count?.progresses, edges: item._count?.edges, likes } }
        : item

    const optimisticLikes = (tree._count?.likes ?? 0) + (tree.likedByMe ? -1 : 1)
    setTrees((prev) => (prev ? { ...prev, items: prev.items.map((item) => patchItem(item, !tree.likedByMe, optimisticLikes)) } : prev))

    try {
      const response = await fetch(`/api/trees/${tree.id}/like`, { method: 'POST' })
      const result = await response.json()
      if (result.error) throw new Error(result.error.message)
      const { liked, likes } = result.data as { liked: boolean; likes: number }
      // Синхронизируем с серверным состоянием (гонки/лимиты).
      setTrees((prev) => (prev ? { ...prev, items: prev.items.map((item) => patchItem(item, liked, likes)) } : prev))
    } catch (err) {
      console.error('Ошибка лайка:', err)
      // Rollback оптимистичного обновления.
      setTrees((prev) => (prev ? { ...prev, items: prev.items.map((item) => patchItem(item, Boolean(tree.likedByMe), tree._count?.likes ?? 0)) } : prev))
    }
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
        <div className="flex flex-col md:flex-row gap-3 mb-4">
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
                { id: 'popular', label: 'По популярности', Icon: Flame },
                { id: 'newest', label: 'По дате', Icon: Clock },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => changeSort(id)}
                aria-pressed={sortMode === id}
                className={`px-3 py-2 rounded-md text-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  sortMode === id
                    ? 'border-primary text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5 mr-1.5 inline-block align-[-2px]" aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Умная фильтрация: категория + диапазон средней сложности */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-8 p-3 bg-card border border-border rounded-lg">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по категории">
            <button
              type="button"
              onClick={() => changeCategory('')}
              aria-pressed={category === ''}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                category === ''
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Все категории
            </button>
            {TREE_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeCategory(value)}
                aria-pressed={category === value}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  category === value
                    ? 'border-primary text-primary bg-primary/10'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {TREE_CATEGORY_LABELS[value]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 lg:ml-auto shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Сложность</span>
            <input
              type="range"
              min={DIFFICULTY_MIN}
              max={DIFFICULTY_MAX}
              value={minDifficulty}
              onChange={(e) => {
                const value = Number(e.target.value)
                setMinDifficulty(Math.min(value, maxDifficulty))
                setPage(1)
              }}
              className="w-24 accent-[hsl(var(--primary))]"
              aria-label="Минимальная средняя сложность дерева"
            />
            <span className="text-sm text-foreground w-6 text-center" aria-live="polite">
              {minDifficulty}
            </span>
            <span className="text-xs text-muted-foreground" aria-hidden>
              —
            </span>
            <input
              type="range"
              min={DIFFICULTY_MIN}
              max={DIFFICULTY_MAX}
              value={maxDifficulty}
              onChange={(e) => {
                const value = Number(e.target.value)
                setMaxDifficulty(Math.max(value, minDifficulty))
                setPage(1)
              }}
              className="w-24 accent-[hsl(var(--primary))]"
              aria-label="Максимальная средняя сложность дерева"
            />
            <span className="text-sm text-foreground w-6 text-center" aria-live="polite">
              {maxDifficulty}
            </span>
          </div>
        </div>

        {isLoading ? (
          /* Skeleton записей каталога (строки ledger, не карточки). */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12" role="status" aria-label="Загрузка каталога">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-5 py-5 border-b border-border/60 animate-pulse">
                <div className="flex-1 space-y-3">
                  <div className="h-5 w-40 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
                <div className="w-36 shrink-0 border-l border-border/60 pl-4 space-y-2">
                  <div className="h-4 w-16 rounded bg-muted" />
                  <div className="h-3 w-20 rounded bg-muted" />
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
            {/* Разворот бестиария: записи в две колонки, метаданные на полях
                каждой записи (см. TreeCard variant="ledger"). Не grid 3xN. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 items-start">
              {trees.items.map((tree) => (
                <TreeCard
                  key={tree.id}
                  tree={tree}
                  isPublic
                  canLike
                  variant="ledger"
                  onToggleLike={(t) => void toggleLike(t)}
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

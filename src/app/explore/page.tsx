'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TreeCard } from '@/entities/tree/ui/TreeCard'
import type { Tree } from '@/entities/tree/model/types'
import { Button } from '@/shared/ui/Button'
import { Loader2, Search, Compass } from 'lucide-react'

type SortMode = 'newest' | 'popular'

export default function ExplorePage() {
  const router = useRouter()
  const [trees, setTrees] = useState<Tree[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('popular')

  useEffect(() => {
    const fetchPublicTrees = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/trees?scope=public')
        const result = await response.json()
        if (result.error) {
          setError(result.error.message)
          return
        }
        setTrees(result.data as Tree[])
      } catch (err) {
        console.error('Ошибка загрузки каталога:', err)
        setError('Не удалось загрузить публичные деревья')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchPublicTrees()
  }, [])

  // Клиентский поиск + сортировка — достаточно для MVP-каталога.
  const visibleTrees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    const filtered = query
      ? trees.filter(
          (tree) =>
            tree.title.toLowerCase().includes(query) ||
            (tree.description ?? '').toLowerCase().includes(query)
        )
      : trees

    const popularity = (tree: Tree) => tree._count?.progresses ?? 0
    // createdAt приходит из JSON строкой — сравниваем как метки времени.
    const createdMs = (tree: Tree) => new Date(tree.createdAt).getTime()
    return [...filtered].sort((a, b) =>
      sortMode === 'popular' ? popularity(b) - popularity(a) : createdMs(b) - createdMs(a)
    )
  }, [trees, searchQuery, sortMode])

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Каталог деревьев</h1>
            <p className="text-gray-400">Публичные skill-деревья сообщества</p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/tree/new')}>
            Создать своё дерево
          </Button>
        </div>

        {/* Поиск и сортировка */}
        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
                onClick={() => setSortMode(option.id)}
                className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                  sortMode === option.id
                    ? 'border-primary text-primary'
                    : 'border-border text-gray-400 hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Ошибка загрузки</h2>
            <p className="text-gray-400">{error}</p>
          </div>
        ) : visibleTrees.length === 0 ? (
          /* Empty state: без данных вообще либо ничего не найдено по фильтру */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-card border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <Compass className="w-8 h-8 text-gray-500" />
            </div>
            {searchQuery ? (
              <>
                <h2 className="text-xl font-semibold mb-2">Ничего не найдено</h2>
                <p className="text-gray-400">Попробуйте изменить поисковый запрос</p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold mb-2">Пока нет публичных деревьев</h2>
                <p className="text-gray-400 mb-6">Создайте первое дерево и поделитесь им с сообществом</p>
                <Button onClick={() => router.push('/tree/new')}>Создать дерево</Button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleTrees.map((tree) => (
              <TreeCard
                key={tree.id}
                tree={tree}
                isPublic
                onSelect={() => router.push(`/tree/${tree.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

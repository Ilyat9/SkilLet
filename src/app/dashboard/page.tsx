'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchTrees()
    }
  }, [status, router])

  const fetchTrees = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/trees?scope=mine')
      const result = await response.json()
      if (result.data) {
        setTrees(result.data)
      }
    } catch (error) {
      console.error('Ошибка загрузки деревьев:', error)
    } finally {
      setIsLoading(false)
    }
  }

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
        ) : trees.length === 0 ? (
          <EmptyState
            icon={Lock}
            title="У вас пока нет деревьев"
            description="Создайте первое дерево или выберите публичное для изучения"
            action={
              <Button asChild>
                <Link href="/tree/new">
                  <Plus className="w-5 h-5 mr-2" />
                  Создать дерево
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trees.map((tree) => (
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

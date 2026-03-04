'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { Button } from '@/shared/ui/Button'
import { TreeCard } from '@/entities/tree/ui/TreeCard'
import { TreeWithRelations } from '@/entities/tree/model/types'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Loader2, Lock } from 'lucide-react'

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
      const response = await fetch('/api/trees?isPublic=false')
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Мои деревья</h1>
            <p className="text-gray-400">Управляйте вашими навыками</p>
          </div>
          <Button asChild>
            <Link href="/tree/new">
              <Plus className="w-5 h-5 mr-2" />
              Создать дерево
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : trees.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-card border border-border rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-gray-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">У вас пока нет деревьев</h2>
            <p className="text-gray-400 mb-6">Создайте первое дерево или выберите публичное для изучения</p>
            <Button asChild>
              <Link href="/tree/new">
                <Plus className="w-5 h-5 mr-2" />
                Создать дерево
              </Link>
            </Button>
          </div>
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

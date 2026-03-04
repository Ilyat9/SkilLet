'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { SkillTreeViewer } from '@/widgets/SkillTreeViewer'
import { ProgressSidebar } from '@/widgets/ProgressSidebar'
import { MarkCompleteButton } from '@/features/progress-tracker/ui/MarkCompleteButton'
import { Node as PrismaNode, Edge as PrismaEdge, Tree, UserProgress } from '@prisma/client'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function TreePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useAuth()

  const [tree, setTree] = useState<Tree | null>(null)
  const [nodes, setNodes] = useState<PrismaNode[]>([])
  const [edges, setEdges] = useState<PrismaEdge[]>([])
  const [progress, setProgress] = useState<UserProgress | null>(null)
  const [_, setCompletedNodeIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    fetchTree()
  }, [status, params.id, router])

  const fetchTree = async () => {
    if (!params.id) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/trees/${params.id}`)
      const result = await response.json()

      if (result.error) {
        if (result.error.code === 'NOT_FOUND') {
          router.push('/dashboard')
        }
        return
      }

      const treeData = result.data

      setTree(treeData)
      setNodes(treeData.nodes || [])
      setEdges(
        (treeData.nodes || []).flatMap((n: PrismaNode & { outgoingEdges: PrismaEdge[] }) => n.outgoingEdges || [])
      )

      const completedIds = new Set<string>(
        (treeData.progresses || [])
          .filter((p: { completed: boolean }) => p.completed)
          .map((p: { nodeId: string }) => p.nodeId)
      )
      setCompletedNodeIds(completedIds)
    } catch (error) {
      console.error('Ошибка загрузки дерева:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNodeClick = async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return

    const isCompleted = completedNodeIds.has(nodeId)
    setCompletedNodeIds(prev => new Set(prev).add(nodeId))

    try {
      const response = await fetch(`/api/trees/${params.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treeId: params.id,
          nodeId,
          completed: !isCompleted,
        }),
      })

      const result = await response.json()
      if (!result.error) {
        setProgress(result.data)
      } else {
        setCompletedNodeIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(nodeId)
          return newSet
        })
      }
    } catch (error) {
      console.error('Ошибка обновления прогресса:', error)
      setCompletedNodeIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(nodeId)
        return newSet
      })
    }
  }

  const handleResourceClick = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (node?.resources.length > 0) {
      const resource = node.resources[0]
      if (resource.type === 'video') {
        window.open(resource.url, '_blank')
      } else {
        window.open(resource.url, '_blank')
      }
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!tree) {
    return null
  }

  const totalNodes = nodes.length
  const completedNodes = completedNodeIds.size

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1">
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 rounded hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">{tree.title}</h1>
                {tree.description && (
                  <p className="text-sm text-gray-400">{tree.description}</p>
                )}
              </div>
            </div>
            {session?.user?.id === tree.authorId && (
              <Badge variant="warning">Редактор</Badge>
            )}
          </div>
        </header>

        <div className="p-4">
          <SkillTreeViewer
            nodes={nodes}
            edges={edges}
            completedNodeIds={completedNodeIds}
            onNodeClick={handleNodeClick}
            onResourceClick={handleResourceClick}
          />
        </div>
      </div>

      <aside className="w-80 border-l border-border p-4 bg-card">
        <ProgressSidebar
          tree={tree}
          progress={progress}
          totalNodes={totalNodes}
          completedNodes={completedNodes}
          isLocked={!progress || !progress.completed}
        />

        {nodes.map((node) => (
          <div key={node.id} className="mb-4">
            <MarkCompleteButton
              node={node}
              isCompleted={completedNodeIds.has(node.id)}
              onToggle={(completed) => {
                setCompletedNodeIds(prev => {
                  const newSet = new Set(prev)
                  if (completed) {
                    newSet.add(node.id)
                  } else {
                    newSet.delete(node.id)
                  }
                  return newSet
                })
              }}
            />
          </div>
        ))}
      </aside>
    </div>
  )
}

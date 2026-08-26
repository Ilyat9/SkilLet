'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { SkillTreeViewer } from '@/widgets/SkillTreeViewer'
import { TreeEditor } from '@/features/tree-builder/ui/TreeEditor'
import type { EditorNode, EditorEdge } from '@/features/tree-builder/model/useTreeEditor'
import { ProgressSidebar } from '@/widgets/ProgressSidebar'
import { MarkCompleteButton } from '@/features/progress-tracker/ui/MarkCompleteButton'
import { Node as PrismaNode, Edge as PrismaEdge, Tree } from '@prisma/client'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, ArrowLeft, PencilLine } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { parseResources } from '@/entities/node/model/schemas'
import type { Node as AppNode } from '@/entities/node/model/types'

type ApiNode = Omit<PrismaNode, 'resources'> & {
  resources: unknown
  outgoingEdges?: PrismaEdge[]
  incomingEdges?: PrismaEdge[]
}

/** Приводит узлы из API к типовому виду приложения: resources Json → Resource[]. */
function toAppNodes(apiNodes: ApiNode[]): AppNode[] {
  return apiNodes.map((node) => ({
    ...node,
    description: node.description ?? null,
    resources: parseResources(node.resources),
    outgoingEdges: node.outgoingEdges ?? [],
    incomingEdges: node.incomingEdges ?? [],
  }))
}

export default function TreePage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useAuth()

  const [tree, setTree] = useState<Tree | null>(null)
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [edges, setEdges] = useState<PrismaEdge[]>([])
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)

  const rawId = params.id
  const treeId = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined
  const isOwner = Boolean(session?.user?.id && tree && session.user.id === tree.authorId)

  const fetchTree = useCallback(async () => {
    if (!treeId) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/trees/${treeId}`)
      const result = await response.json()

      if (result.error) {
        if (result.error.code === 'NOT_FOUND') {
          router.push('/dashboard')
        }
        return
      }

      const treeData = result.data as Tree & {
        nodes?: ApiNode[]
        progresses?: Array<{ nodeId: string; completed: boolean }>
      }

      setTree(treeData)
      setNodes(toAppNodes(treeData.nodes ?? []))
      setEdges((treeData.nodes ?? []).flatMap((n) => n.outgoingEdges ?? []))

      const completedIds = new Set<string>(
        (treeData.progresses ?? []).filter((p) => p.completed).map((p) => p.nodeId)
      )
      setCompletedNodeIds(completedIds)
    } catch (error) {
      console.error('Ошибка загрузки дерева:', error)
    } finally {
      setIsLoading(false)
    }
  }, [treeId, router])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    void fetchTree()
  }, [status, fetchTree, router])

  // Реальный toggle с оптимистичным обновлением и откатом при ошибке.
  const handleNodeClick = async (nodeId: string) => {
    if (!treeId) return
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return

    const isCompleted = completedNodeIds.has(nodeId)
    setCompletedNodeIds((prev) => {
      const next = new Set(prev)
      if (isCompleted) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })

    // Откат в противоположную сторону от оптимистичного апдейта.
    const rollback = () => {
      setCompletedNodeIds((prev) => {
        const next = new Set(prev)
        if (isCompleted) {
          next.add(nodeId)
        } else {
          next.delete(nodeId)
        }
        return next
      })
    }

    try {
      // treeId не передаём в body — сервер берёт его из URL.
      const response = await fetch(`/api/trees/${treeId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, completed: !isCompleted }),
      })

      const result = await response.json()
      if (result.error) {
        rollback()
      }
    } catch (error) {
      console.error('Ошибка обновления прогресса:', error)
      rollback()
    }
  }

  const handleResourceClick = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)
    const resource = node?.resources[0]
    if (!resource) return
    window.open(resource.url, '_blank')
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

  const editorInitialNodes: EditorNode[] = nodes.map((node) => ({
    id: node.id,
    type: 'default',
    position: { x: node.positionX, y: node.positionY },
    data: {
      title: node.title,
      description: node.description ?? undefined,
      difficulty: node.difficulty,
    },
  }))

  const editorInitialEdges: EditorEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'smoothstep',
  }))

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Тулбар страницы — общий хедер подключён в layout */}
      <div className="bg-card border-b border-border shrink-0">
        <div className="max-w-full px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/dashboard" className="p-2 rounded hover:bg-gray-700 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate">{tree.title}</h1>
              {tree.description && <p className="text-sm text-gray-400 truncate">{tree.description}</p>}
            </div>
          </div>
          {isOwner && (
            <Button
              size="sm"
              variant={isEditMode ? 'secondary' : 'ghost'}
              onClick={() => setIsEditMode((v) => !v)}
            >
              <PencilLine className="w-4 h-4 mr-1" />
              {isEditMode ? 'Закрыть редактор' : 'Редактор'}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 p-4">
          {isEditMode && isOwner ? (
            <TreeEditor
              treeId={tree.id}
              initialNodes={editorInitialNodes}
              initialEdges={editorInitialEdges}
              onExit={() => setIsEditMode(false)}
              onChanged={() => {
                void fetchTree()
              }}
            />
          ) : (
            <SkillTreeViewer
              nodes={nodes}
              edges={edges}
              completedNodeIds={completedNodeIds}
              onNodeClick={handleNodeClick}
              onResourceClick={handleResourceClick}
            />
          )}
        </div>

        {!isEditMode && (
          <aside className="w-80 border-l border-border p-4 bg-card overflow-y-auto shrink-0">
            <ProgressSidebar totalNodes={totalNodes} completedNodes={completedNodes} />

            {nodes.map((node) => (
              <div key={node.id} className="mt-4">
                <MarkCompleteButton
                  node={node}
                  completedNodeIds={completedNodeIds}
                  isCompleted={completedNodeIds.has(node.id)}
                  onToggle={(completed) => {
                    setCompletedNodeIds((prev) => {
                      const next = new Set(prev)
                      if (completed) {
                        next.add(node.id)
                      } else {
                        next.delete(node.id)
                      }
                      return next
                    })
                  }}
                />
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}


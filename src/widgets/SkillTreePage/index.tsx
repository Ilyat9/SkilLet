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
import { parseResources } from '@/entities/node/model/schemas'
import { useToast } from '@/shared/ui/Toast'
import { Button } from '@/shared/ui/Button'
import {
  Loader2,
  ArrowLeft,
  PencilLine,
  Share2,
  AlertTriangle,
  PlusCircle,
  X,
  ListChecks,
} from 'lucide-react'

interface ApiNodeInput extends Omit<PrismaNode, 'resources'> {
  resources: unknown
  outgoingEdges?: PrismaEdge[]
  incomingEdges?: PrismaEdge[]
}

export interface AppTreeNode extends Omit<PrismaNode, 'resources'> {
  description: string | null
  resources: ReturnType<typeof parseResources>
  outgoingEdges: PrismaEdge[]
  incomingEdges: PrismaEdge[]
}

/** Приводит узлы из API к типовому виду приложения: resources Json → Resource[]. */
function toAppNodes(apiNodes: ApiNodeInput[]): AppTreeNode[] {
  return apiNodes.map((node) => ({
    ...node,
    description: node.description ?? null,
    resources: parseResources(node.resources),
    outgoingEdges: node.outgoingEdges ?? [],
    incomingEdges: node.incomingEdges ?? [],
  }))
}

type LoadError = 'NOT_FOUND' | 'FORBIDDEN' | 'NETWORK' | null

const LOAD_ERROR_CONTENT: Record<Exclude<LoadError, null>, { title: string; text: string }> = {
  NOT_FOUND: { title: 'Дерево не найдено', text: 'Возможно, оно было удалено или ссылка неверна.' },
  FORBIDDEN: { title: 'Нет доступа', text: 'Это приватное дерево — попросите автора открыть доступ.' },
  NETWORK: { title: 'Ошибка загрузки', text: 'Проверьте соединение и попробуйте ещё раз.' },
}

/**
 * Клиентская часть страницы дерева: загрузка, просмотр/редактирование,
 * прогресс, шаринг и адаптивный сайдбар (drawer на мобильных).
 */
export function SkillTreePage({ treeId }: { treeId: string }) {
  const { data: session, status } = useAuth()
  const { showToast } = useToast()

  const [tree, setTree] = useState<Tree | null>(null)
  const [nodes, setNodes] = useState<AppTreeNode[]>([])
  const [edges, setEdges] = useState<PrismaEdge[]>([])
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [loadError, setLoadError] = useState<LoadError>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isShareCopied, setIsShareCopied] = useState(false)

  const isOwner = Boolean(session?.user?.id && tree && session.user.id === tree.authorId)

  const fetchTree = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`/api/trees/${treeId}`)
      const result = await response.json()

      if (result.error) {
        // Ошибку показываем явным состоянием страницы, а не редиректом в тишине.
        const code = (result.error.code === 'NOT_FOUND' || result.error.code === 'FORBIDDEN'
          ? result.error.code
          : 'NETWORK') as Exclude<LoadError, null>
        setLoadError(code)
        return
      }

      const treeData = result.data as Tree & {
        nodes?: ApiNodeInput[]
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
      setLoadError('NETWORK')
    } finally {
      setIsLoading(false)
    }
  }, [treeId])

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      window.location.href = '/login'
      return
    }
    void fetchTree()
  }, [status, fetchTree])

  // Оптимистичный toggle с откатом при ошибке сервера.
  const handleNodeClick = async (nodeId: string) => {
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
        showToast(result.error.message ?? 'Не удалось обновить прогресс', 'error')
      }
    } catch (error) {
      console.error('Ошибка обновления прогресса:', error)
      rollback()
      showToast('Ошибка обновления прогресса', 'error')
    }
  }

  const handleResourceClick = (nodeId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const node = nodes.find((n) => n.id === nodeId)
    const resource = node?.resources[0]
    if (!resource) return
    window.open(resource.url, '_blank')
  }

  /** Копирует текущий URL публичного дерева в буфер обмена. */
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setIsShareCopied(true)
      showToast('Ссылка на дерево скопирована', 'success')
      window.setTimeout(() => setIsShareCopied(false), 2000)
    } catch {
      showToast('Не удалось скопировать ссылку', 'error')
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  // Явные ошибочные состояния вместо «молчаливого» редиректа.
  if (loadError && !tree) {
    const content = LOAD_ERROR_CONTENT[loadError]
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">{content.title}</h1>
          <p className="text-gray-400 mb-6">{content.text}</p>
          <Button asChild className="w-full">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться на дашборд
            </Link>
          </Button>
          {loadError !== 'NOT_FOUND' && (
            <button
              onClick={() => void fetchTree()}
              className="mt-3 text-sm text-gray-400 hover:text-foreground underline"
            >
              Повторить попытку
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!tree) return null

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
      ...(node.resources[0]
        ? {
            resourceType: node.resources[0].type,
            resourceUrl: node.resources[0].url,
            resourceTitle: node.resources[0].title,
          }
        : {}),
    },
  }))

  const editorInitialEdges: EditorEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    type: 'smoothstep',
  }))

  /** Содержимое сайдбара — общее для desktop-колонки и mobile-drawer. */
  const sidebarContent = (
    <>
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
    </>
  )

  return (
    <TreePageLayout
      tree={tree}
      isOwner={isOwner}
      isEditMode={isEditMode}
      setIsEditMode={(value) => setIsEditMode(value)}
      onShare={() => void handleShare()}
      isShareCopied={isShareCopied}
      sidebarOpen={isSidebarOpen}
      setSidebarOpen={(value) => setIsSidebarOpen(value)}
      sidebarContent={sidebarContent}
    >
      {/* Содержимое основной области */}
      {!isEditMode && totalNodes === 0 ? (
        /* Пустое дерево: понятная заглушка с CTA для владельца. */
        <div className="h-full flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <PlusCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">В дереве пока нет навыков</h2>
            <p className="text-gray-400 mb-6">
              {isOwner
                ? 'Добавьте первый узел и свяжите его с будущими — дальше дерево растёт само.'
                : 'Автор ещё не наполнил это дерево навыками. Загляните позже!'}
            </p>
            {isOwner && (
              <Button onClick={() => setIsEditMode(true)}>
                <PencilLine className="w-4 h-4 mr-2" />
                Добавить первый узел
              </Button>
            )}
          </div>
        </div>
      ) : isEditMode && isOwner ? (
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
          onNodeClick={(nodeId) => void handleNodeClick(nodeId)}
          onResourceClick={handleResourceClick}
        />
      )}
    </TreePageLayout>
  )
}

/** Разметка страницы: тулбар, основная область, desktop-сайдбар и mobile-drawer. */
interface TreePageLayoutProps {
  tree: Tree
  isOwner: boolean
  isEditMode: boolean
  setIsEditMode: (value: boolean) => void
  onShare: () => void
  isShareCopied: boolean
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void
  sidebarContent: React.ReactNode
  children: React.ReactNode
}

function TreePageLayout({
  tree,
  isOwner,
  isEditMode,
  setIsEditMode,
  onShare,
  isShareCopied,
  sidebarOpen,
  setSidebarOpen,
  sidebarContent,
  children,
}: TreePageLayoutProps) {
  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Тулбар страницы */}
      <div className="bg-card border-b border-border shrink-0">
        <div className="max-w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="p-2 rounded hover:bg-gray-700 transition-colors shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate">{tree.title}</h1>
              {tree.description && (
                <p className="text-xs sm:text-sm text-gray-400 truncate">{tree.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Кнопка «Поделиться» видна только у публичных деревьев. */}
            {tree.isPublic && (
              <Button size="sm" variant="ghost" onClick={onShare}>
                <Share2 className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{isShareCopied ? 'Скопировано!' : 'Поделиться'}</span>
              </Button>
            )}
            {isOwner && (
              <Button size="sm" variant={isEditMode ? 'secondary' : 'ghost'} onClick={() => setIsEditMode(!isEditMode)}>
                <PencilLine className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{isEditMode ? 'Закрыть редактор' : 'Редактор'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        <div className="flex-1 min-w-0 p-2 sm:p-4 overflow-hidden">{children}</div>

        {/* Desktop: фиксированный сайдбар справа; на мобильных скрыт. */}
        {!isEditMode && (
          <aside className="hidden lg:block w-80 border-l border-border p-4 bg-card overflow-y-auto shrink-0">
            {sidebarContent}
          </aside>
        )}

        {/* Mobile: плавающая кнопка с быстрым прогрессом + bottom-sheet drawer. */}
        {!isEditMode && (
          <>
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg"
            >
              <ListChecks className="w-5 h-5" />
              Прогресс
            </button>

            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
                <div className="relative w-full max-h-[75vh] overflow-y-auto bg-card border-t border-border rounded-t-xl p-4 pb-8">
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-card pb-2">
                    <h2 className="font-semibold">Прогресс по узлам</h2>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      aria-label="Закрыть"
                      className="p-1 rounded hover:bg-gray-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {sidebarContent}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

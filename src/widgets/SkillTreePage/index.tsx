'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/ui/useAuth'
import { SkillTreeViewer } from '@/widgets/SkillTreeViewer'
import { TreeEditor } from '@/features/tree-builder/ui/TreeEditor'
import type { EditorNode, EditorEdge } from '@/features/tree-builder/model/useTreeEditor'
import { ProgressSidebar } from '@/widgets/ProgressSidebar'
import { NodeDetailsCard } from '@/widgets/SkillTreePage/NodeDetailsCard'
import { Node as PrismaNode, Edge as PrismaEdge, Tree } from '@prisma/client'
import Link from 'next/link'
import { parseResources } from '@/entities/node/model/schemas'
import { cn } from '@/shared/lib/utils'
import { useToast } from '@/shared/ui/Toast'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { EmptyState } from '@/shared/ui/EmptyState'
import { CommentsSection } from '@/widgets/CommentsSection'
import {
  ArrowLeft,
  PencilLine,
  Share2,
  AlertTriangle,
  PlusCircle,
  X,
  ListChecks,
  Trash2,
  Heart,
  GitFork,
  Download,
  Lock,
  CheckCircle2,
  Circle,
  Info,
} from 'lucide-react'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import { NODE_STATUS } from '@/shared/constants'

interface ApiNodeInput extends Omit<PrismaNode, 'resources'> {
  resources: unknown
}

export interface AppTreeNode extends Omit<PrismaNode, 'resources'> {
  description: string | null
  resources: ReturnType<typeof parseResources>
  outgoingEdges: PrismaEdge[]
  incomingEdges: PrismaEdge[]
}

/**
 * Приводит узлы из API к типовому виду приложения: resources Json → Resource[],
 * а incoming/outgoing рёбра каждого узла вычисляются из ЕДИНОГО массива рёбер
 * дерева (GET /api/trees/[id] возвращает edges на уровне дерева — без
 * дублирования каждого ребра дважды в payload).
 */
function toAppNodes(apiNodes: ApiNodeInput[], treeEdges: PrismaEdge[]): AppTreeNode[] {
  return apiNodes.map((node) => ({
    ...node,
    description: node.description ?? null,
    resources: parseResources(node.resources),
    outgoingEdges: treeEdges.filter((e) => e.sourceId === node.id),
    incomingEdges: treeEdges.filter((e) => e.targetId === node.id),
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
  const router = useRouter()

  const [tree, setTree] = useState<(Tree & { _count?: { nodes: number; edges: number } }) | null>(null)
  const [nodes, setNodes] = useState<AppTreeNode[]>([])
  const [edges, setEdges] = useState<PrismaEdge[]>([])
  const [completedNodeIds, setCompletedNodeIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [loadError, setLoadError] = useState<LoadError>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isShareCopied, setIsShareCopied] = useState(false)
  // Выбранный узел: клик по графу открывает его карточку в сайдбаре
  // (детали + материалы + отметка прогресса). Сам клик прогресс НЕ меняет.
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  // Онбординг-подсказка «как это работает» — показывается до первого закрытия.
  const [showHint, setShowHint] = useState(false)
  // Подтверждение удаления дерева: hard-delete каскадно стирает узлы, рёбра
  // и весь прогресс — требуем явного подтверждения с перечислением последствий.
  const [isDeleteTreeConfirmOpen, setIsDeleteTreeConfirmOpen] = useState(false)
  const [isDeletingTree, setIsDeletingTree] = useState(false)

  // Лайки и форк: локальное состояние синхронизируется с GET /api/trees/[id].
  const [likedByMe, setLikedByMe] = useState(false)
  const [likes, setLikes] = useState(0)
  const [isLikeBusy, setIsLikeBusy] = useState(false)
  const [isForking, setIsForking] = useState(false)

  const handleDeleteTree = async () => {
    setIsDeletingTree(true)
    try {
      const response = await fetch(`/api/trees/${treeId}`, { method: 'DELETE' })
      const result = await response.json()
      if (result.error) {
        showToast(result.error.message ?? 'Не удалось удалить дерево', 'error')
        return
      }
      showToast('Дерево удалено', 'success')
      router.push('/dashboard')
    } catch {
      showToast('Ошибка удаления дерева', 'error')
    } finally {
      setIsDeletingTree(false)
    }
  }

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
        edges?: PrismaEdge[]
        progresses?: Array<{ nodeId: string; completed: boolean }>
        likedByMe?: boolean
        _count?: { nodes: number; edges: number; likes?: number; comments?: number }
      }

      // Рёбра — единственный источник: массив на уровне дерева.
      const treeEdges: PrismaEdge[] = treeData.edges ?? []
      setTree(treeData)
      setNodes(toAppNodes(treeData.nodes ?? [], treeEdges))
      setEdges(treeEdges)
      setLikedByMe(Boolean(treeData.likedByMe))
      setLikes(treeData._count?.likes ?? 0)

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
    // Показываем онбординг один раз на устройство (до первого закрытия).
    try {
      if (!window.localStorage.getItem('skillet-tree-hint-dismissed')) setShowHint(true)
    } catch {
      setShowHint(true)
    }
  }, [status, fetchTree])

  const dismissHint = () => {
    setShowHint(false)
    try {
      window.localStorage.setItem('skillet-tree-hint-dismissed', '1')
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  }

  /** Выбор узла графа: повторный клик по выбранному закрывает карточку. */
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      setIsSidebarOpen(true)
    }
  }

  // При выборе узла подтягиваем его пункт списка в видимую область сайдбара —
  // карточка раскрывается под пунктом и должна быть видна.
  useEffect(() => {
    if (!selectedNodeId) return
    document
      .querySelector(`[data-node-id="${selectedNodeId}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedNodeId])

  const unlockCountFor = (nodeId: string) =>
    edges.filter((e) => {
      if (e.sourceId !== nodeId) return false
      const child = nodes.find((n) => n.id === e.targetId)
      return child !== undefined && getNodeStatus(child, completedNodeIds) === NODE_STATUS.LOCKED
    }).length

  /** Обновление прогресса из карточки под узлом (ставит/снимает отметку локально). */
  const handleToggleProgress = (nodeId: string, completed: boolean) => {
    setCompletedNodeIds((prev) => {
      const next = new Set(prev)
      if (completed) {
        next.add(nodeId)
      } else {
        next.delete(nodeId)
      }
      return next
    })
  }

  /** Оптимистичный тоггл лайка дерева (с rollback при ошибке). */
  const handleToggleLike = async () => {
    if (status !== 'authenticated') {
      window.location.href = '/login'
      return
    }
    if (isLikeBusy) return
    setIsLikeBusy(true)
    const prevLiked = likedByMe
    const prevLikes = likes
    setLikedByMe(!prevLiked)
    setLikes(prevLikes + (prevLiked ? -1 : 1))
    try {
      const response = await fetch(`/api/trees/${treeId}/like`, { method: 'POST' })
      const result = await response.json()
      if (result.error) throw new Error(result.error.message)
      const data = result.data as { liked: boolean; likes: number }
      setLikedByMe(data.liked)
      setLikes(data.likes)
    } catch (error) {
      console.error('Ошибка лайка:', error)
      setLikedByMe(prevLiked)
      setLikes(prevLikes)
      showToast('Не удалось поставить лайк', 'error')
    } finally {
      setIsLikeBusy(false)
    }
  }

  /**
   * Форк публичного чужого дерева: создаёт копию (Tree + Node + Edge) в
   * аккаунте текущего пользователя и открывает её.
   */
  const handleFork = async () => {
    if (isForking) return
    setIsForking(true)
    try {
      const response = await fetch(`/api/trees/${treeId}/fork`, { method: 'POST' })
      const result = await response.json()
      if (result.error) {
        showToast(result.error.message ?? 'Не удалось форкнуть дерево', 'error')
        return
      }
      showToast('Дерево скопировано в ваши деревья', 'success')
      router.push(`/tree/${result.data.id}`)
    } catch (error) {
      console.error('Ошибка форка:', error)
      showToast('Ошибка форка дерева', 'error')
    } finally {
      setIsForking(false)
    }
  }

  /**
   * Экспорт дерева в JSON (portable-формат SkilLet): скачивается файл без
   * внутренних id — его можно импортировать через «Импортировать дерево».
   */
  const handleExport = () => {
    if (!tree) return
    const exported = {
      format: 'skillet-tree' as const,
      version: 1,
      title: tree.title,
      ...(tree.description ? { description: tree.description } : {}),
      category: tree.category,
      nodes: nodes.map((node) => ({
        title: node.title,
        ...(node.description ? { description: node.description } : {}),
        positionX: node.positionX,
        positionY: node.positionY,
        difficulty: node.difficulty,
        ...(node.resources[0]
          ? {
              resourceType: node.resources[0].type,
              resourceUrl: node.resources[0].url,
              resourceTitle: node.resources[0].title,
            }
          : {}),
      })),
      // Связи — пары локальных индексов массива nodes (формат prisma/seed.ts).
      connections: edges
        .map((edge) => {
          const sourceIndex = nodes.findIndex((n) => n.id === edge.sourceId)
          const targetIndex = nodes.findIndex((n) => n.id === edge.targetId)
          return sourceIndex >= 0 && targetIndex >= 0 ? ([sourceIndex, targetIndex] as const) : null
        })
        .filter((pair): pair is readonly [number, number] => pair !== null),
    }

    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${tree.title.replace(/[^\p{L}\p{N}\s-]/gu, '').trim() || 'tree'}.skillet.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    showToast('Файл дерева скачан', 'success')
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
    /* Skeleton тулбар+canvas+sidebar — согласован с tree/[id]/loading.tsx. */
    return (
      <div className="h-screen bg-background flex flex-col" role="status" aria-label="Загрузка дерева">
        <div className="bg-card border-b border-border shrink-0">
          <div className="px-3 sm:px-4 py-3 flex items-center gap-4">
            <div className="w-9 h-9 rounded bg-muted animate-pulse shrink-0" />
            <div className="space-y-1.5 min-w-0 flex-1 max-w-xs">
              <div className="h-5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 p-2 sm:p-4 overflow-hidden">
            <div className="h-full w-full rounded-lg border border-border bg-muted/30 animate-pulse" />
          </div>
          {!isEditMode && (
            <aside className="hidden lg:block w-80 border-l border-border p-4 bg-card shrink-0 space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div className="h-5 w-24 rounded bg-muted animate-pulse" />
                <div className="h-3 w-36 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
              </div>
              <div className="rounded-lg border border-border p-4 h-14 animate-pulse" />
              <div className="rounded-lg border border-border p-4 h-14 animate-pulse" />
            </aside>
          )}
        </div>
      </div>
    )
  }

  // Явные ошибочные состояния вместо «молчаливого» редиректа.
  if (loadError && !tree) {
    const content = LOAD_ERROR_CONTENT[loadError]
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-10 h-10 text-warning mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">{content.title}</h1>
          <p className="text-muted-foreground mb-6">{content.text}</p>
          <Button asChild className="w-full">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться на дашборд
            </Link>
          </Button>
          {loadError !== 'NOT_FOUND' && (
            <button
              onClick={() => void fetchTree()}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground underline"
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

  /** Заголовок навыка, блокирующего данный (первый непройденный пререквизит). */
  const blockedByTitle = (node: AppTreeNode): string | null => {
    for (const edge of node.incomingEdges) {
      const parent = nodes.find((n) => n.id === edge.sourceId)
      if (parent && !completedNodeIds.has(parent.id)) return parent.title
    }
    return null
  }

  const statusGroups: { key: string; label: string; items: AppTreeNode[] }[] = [
    {
      key: 'available',
      label: 'Доступно сейчас',
      items: nodes.filter((n) => getNodeStatus(n, completedNodeIds) === NODE_STATUS.AVAILABLE),
    },
    {
      key: 'completed',
      label: 'Пройдено',
      items: nodes.filter((n) => completedNodeIds.has(n.id)),
    },
    {
      key: 'locked',
      label: 'Заблокировано',
      items: nodes.filter((n) => getNodeStatus(n, completedNodeIds) === NODE_STATUS.LOCKED),
    },
  ]

  /** Содержимое сайдбара — общее для desktop-колонки и mobile-drawer. */
  const sidebarContent = (
    <>
      {showHint && (
        <div className="mb-4 bg-primary/10 border border-primary/40 rounded-lg p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <p className="text-foreground/90">
                Кликни узел на графе — увидишь навык и материалы. Пройди источник и отметь
                пройденным — это откроет следующие узлы.
              </p>
            </div>
            <button
              onClick={dismissHint}
              aria-label="Скрыть подсказку"
              className="p-0.5 rounded hover:bg-secondary shrink-0"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      <ProgressSidebar totalNodes={totalNodes} completedNodes={completedNodes} />

      {/* Список навыков по статусам: названия видны всегда, заблокированные — с причиной. */}
      <div className="mt-4 space-y-4">
        {statusGroups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.key}>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {group.label} · {group.items.length}
                </h4>
                <ul className="space-y-1">
                  {group.items.map((node) => {
                    const isSelected = node.id === selectedNodeId
                    const isLocked = getNodeStatus(node, completedNodeIds) === NODE_STATUS.LOCKED
                    const blocker = isLocked ? blockedByTitle(node) : null
                    // Заблокированный навык — не кнопка: никаких деталей,
                    // описания и материалов, пока не открыты пререквизиты.
                    if (isLocked) {
                      return (
                        <li key={node.id} data-node-id={node.id}>
                          <div
                            aria-disabled="true"
                            className="w-full px-2 py-1.5 rounded-md flex items-start gap-2 opacity-70 cursor-default"
                          >
                            <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                            <span className="min-w-0">
                              <span className="block text-sm leading-snug">{node.title}</span>
                              {blocker && (
                                <span className="block text-xs text-muted-foreground">
                                  после «{blocker}»
                                </span>
                              )}
                            </span>
                          </div>
                        </li>
                      )
                    }
                    return (
                      <li key={node.id} data-node-id={node.id}>
                        <button
                          onClick={() => handleNodeSelect(node.id)}
                          aria-expanded={isSelected}
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded-md flex items-start gap-2 transition-colors',
                            isSelected ? 'bg-secondary' : 'hover:bg-secondary/60'
                          )}
                        >
                          {completedNodeIds.has(node.id) ? (
                            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" aria-hidden />
                          ) : (
                            <Circle className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                          )}
                          <span className="min-w-0">
                            <span className="block text-sm leading-snug">{node.title}</span>
                          </span>
                        </button>
                        {/* Карточка навыка раскрывается прямо под выбранным пунктом. */}
                        {isSelected && (
                          <div className="mt-1.5 mb-2">
                            <NodeDetailsCard
                              node={node}
                              status={getNodeStatus(node, completedNodeIds)}
                              completedNodeIds={completedNodeIds}
                              isCompleted={completedNodeIds.has(node.id)}
                              blockedByTitle={blockedByTitle(node)}
                              unlockHint={
                                completedNodeIds.has(node.id)
                                  ? 'Навык засчитан в прогресс и streak.'
                                  : unlockCountFor(node.id) > 0
                                    ? `Отметка пройденным откроет ${unlockCountFor(node.id)} след. навык(ов).`
                                    : 'Отметка пройденным засчитает навык.'
                              }
                              onToggle={(completed) => handleToggleProgress(node.id, completed)}
                              onClose={() => setSelectedNodeId(null)}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
        )}
      </div>
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
      onDeleteTree={() => setIsDeleteTreeConfirmOpen(true)}
      isDeletingTree={isDeletingTree}
      isDeleteTreeConfirmOpen={isDeleteTreeConfirmOpen}
      setIsDeleteTreeConfirmOpen={setIsDeleteTreeConfirmOpen}
      onConfirmDeleteTree={() => void handleDeleteTree()}
      likedByMe={likedByMe}
      likes={likes}
      onToggleLike={() => void handleToggleLike()}
      onFork={() => void handleFork()}
      isForking={isForking}
      onExport={handleExport}
    >
      {/* Содержимое основной области */}
      {!isEditMode && totalNodes === 0 ? (
        /* Пустое дерево: единый EmptyState с CTA для владельца. */
        <EmptyState
          icon={PlusCircle}
          title="В дереве пока нет навыков"
          description={
            isOwner
              ? 'Добавьте первый узел и свяжите его с будущими — дальше дерево растёт само.'
              : 'Автор ещё не наполнил это дерево навыками. Загляните позже!'
          }
          action={
            isOwner ? (
              <Button onClick={() => setIsEditMode(true)}>
                <PencilLine className="w-4 h-4 mr-2" />
                Добавить первый узел
              </Button>
            ) : undefined
          }
          className="h-full flex items-center justify-center"
        />
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
        <div className="space-y-4">
          {/* Граф дерева: фиксированная высота внутри прокручиваемой области. */}
          <div className="h-[calc(100vh-230px)] min-h-[420px]">
            <SkillTreeViewer
              nodes={nodes}
              edges={edges}
              completedNodeIds={completedNodeIds}
              onNodeClick={handleNodeSelect}
              selectedNodeId={selectedNodeId}
            />
          </div>
          {/* Обсуждение под просмотром дерева (скрыто в редакторе). */}
          <CommentsSection treeId={tree.id} treeAuthorId={tree.authorId} />
        </div>
      )}
    </TreePageLayout>
  )
}

/** Разметка страницы: тулбар, основная область, desktop-сайдбар и mobile-drawer. */
type TreeWithCount = Tree & {
  _count?: { nodes: number; edges: number; likes?: number; comments?: number }
  forkedFrom?: {
    id: string
    title: string
    author: { id: string; name: string | null }
  } | null
}

interface TreePageLayoutProps {
  tree: TreeWithCount
  isOwner: boolean
  isEditMode: boolean
  setIsEditMode: (value: boolean) => void
  onShare: () => void
  isShareCopied: boolean
  sidebarOpen: boolean
  setSidebarOpen: (value: boolean) => void
  sidebarContent: React.ReactNode
  children: React.ReactNode
  onDeleteTree: () => void
  isDeletingTree: boolean
  isDeleteTreeConfirmOpen: boolean
  setIsDeleteTreeConfirmOpen: (value: boolean) => void
  onConfirmDeleteTree: () => void
  likedByMe: boolean
  likes: number
  onToggleLike: () => void
  onFork: () => void
  isForking: boolean
  onExport: () => void
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
  onDeleteTree,
  isDeletingTree,
  isDeleteTreeConfirmOpen,
  setIsDeleteTreeConfirmOpen,
  onConfirmDeleteTree,
  likedByMe,
  likes,
  onToggleLike,
  onFork,
  isForking,
  onExport,
}: TreePageLayoutProps) {
  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Тулбар страницы */}
      <div className="bg-card border-b border-border shrink-0">
        <div className="max-w-full px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/dashboard" className="p-2 rounded hover:bg-secondary transition-colors shrink-0" aria-label="К списку деревьев">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold truncate">{tree.title}</h1>
              {tree.description && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{tree.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Лайк: доступен на публичных деревьях (и на своих тоже). */}
            {tree.isPublic && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleLike}
                aria-pressed={likedByMe}
                aria-label={likedByMe ? `Убрать лайк (${likes})` : `Поставить лайк (${likes})`}
                className={likedByMe ? 'text-destructive' : undefined}
              >
                <Heart className={`w-4 h-4 mr-1 ${likedByMe ? 'fill-current' : ''}`} aria-hidden />
                {likes}
              </Button>
            )}
            {/* Форк: доступен на публичных деревьях — копия уходит авторизованному пользователю. */}
            {tree.isPublic && (
              <Button size="sm" variant="ghost" onClick={onFork} disabled={isForking}>
                <GitFork className="w-4 h-4 mr-1" aria-hidden />
                <span className="hidden sm:inline">{isForking ? 'Копируем…' : 'Форкнуть'}</span>
              </Button>
            )}
            {/* Экспорт: скачанный JSON можно импортировать на /tree/new. */}
            <Button size="sm" variant="ghost" onClick={onExport} aria-label="Экспортировать дерево в JSON">
              <Download className="w-4 h-4 mr-1" aria-hidden />
              <span className="hidden sm:inline">Экспорт</span>
            </Button>
            {/* Кнопка «Поделиться» видна только у публичных деревьев. */}
            {tree.isPublic && (
              <Button size="sm" variant="ghost" onClick={onShare}>
                <Share2 className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline">{isShareCopied ? 'Скопировано!' : 'Поделиться'}</span>
              </Button>
            )}
            {isOwner && (
              <>
                <Button size="sm" variant={isEditMode ? 'secondary' : 'ghost'} onClick={() => setIsEditMode(!isEditMode)}>
                  <PencilLine className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">{isEditMode ? 'Закрыть редактор' : 'Редактор'}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onDeleteTree}
                  aria-label="Удалить дерево"
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Атрибуция форка: «форк дерева «X» от @автор» — ссылка на оригинал. */}
        {tree.forkedFrom && (
          <div className="px-3 sm:px-4 pb-2 -mt-1">
            <p className="text-xs text-muted-foreground">
              Форк дерева{' '}
              <Link href={`/tree/${tree.forkedFrom.id}`} className="text-primary underline underline-offset-2">
                «{tree.forkedFrom.title}»
              </Link>{' '}
              от @{tree.forkedFrom.author.name || 'пользователя'}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Прокручиваемая основная область: граф + комментарии под ним. */}
        <div className="flex-1 min-w-0 p-2 sm:p-4 overflow-y-auto">{children}</div>

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
              className="lg:hidden fixed bottom-4 right-4 z-40 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Открыть панель прогресса"
            >
              <ListChecks className="w-5 h-5" aria-hidden />
              Прогресс
            </button>

            {sidebarOpen && (
              <div className="lg:hidden fixed inset-0 z-50 flex items-end justify-center">
                <div className="absolute inset-0 bg-black/50 animate-overlay-in" onClick={() => setSidebarOpen(false)} />
                <div className="relative w-full max-h-[75vh] overflow-y-auto bg-card border-t border-border rounded-t-xl p-4 pb-8 animate-sheet-up">
                  <div className="flex items-center justify-between mb-3 sticky top-0 bg-card pb-2">
                    <h2 className="font-semibold">Прогресс по узлам</h2>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      aria-label="Закрыть"
                      className="p-1 rounded hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X className="w-5 h-5" aria-hidden />
                    </button>
                  </div>
                  {sidebarContent}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Подтверждение удаления дерева: перечисляем всё, что стирается каскадно. */}
      <Modal
        isOpen={isDeleteTreeConfirmOpen}
        onClose={() => setIsDeleteTreeConfirmOpen(false)}
        title="Удалить дерево?"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Дерево <span className="font-semibold text-foreground">«{tree.title}»</span> будет удалено
          безвозвратно. Вместе с ним удалятся:
        </p>
        <ul className="text-sm list-disc pl-5 mb-4 space-y-1">
          <li>
            узлов: <span className="font-semibold">{tree._count?.nodes ?? '—'}</span>
          </li>
          <li>
            связей между ними: <span className="font-semibold">{tree._count?.edges ?? '—'}</span>
          </li>
          <li>все отметки прогресса всех пользователей по этому дереву</li>
        </ul>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setIsDeleteTreeConfirmOpen(false)}>
            Отмена
          </Button>
          <Button size="sm" variant="destructive" onClick={onConfirmDeleteTree} disabled={isDeletingTree}>
            <Trash2 className="w-4 h-4 mr-1" />
            {isDeletingTree ? 'Удаляем…' : 'Удалить безвозвратно'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

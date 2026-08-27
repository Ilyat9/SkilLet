'use client'

import { useCallback, useState } from 'react'
import {
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node as FlowNode,
  type Edge as FlowEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import { validateEdge } from '@/shared/lib/dag'
import { useToast } from '@/shared/ui/Toast'
import '@xyflow/react/dist/style.css'

export type TreeNodeData = {
  title: string
  description?: string | undefined
  difficulty: number
  resourceType?: 'video' | 'article' | undefined
  resourceUrl?: string | undefined
  resourceTitle?: string | undefined
  /** Запрос на удаление ресурса с узла (см. NodeUpdateSchema). */
  clearResource?: boolean | undefined
}

export type EditorNode = FlowNode<TreeNodeData>
export type EditorEdge = FlowEdge

interface UseTreeEditorOptions {
  treeId: string
  initialNodes?: EditorNode[]
  initialEdges?: EditorEdge[]
}

export interface UseTreeEditorReturn {
  nodes: EditorNode[]
  edges: EditorEdge[]
  onNodesChange: (changes: NodeChange<EditorNode>[]) => void
  onEdgesChange: (changes: EdgeChange<EditorEdge>[]) => void
  onConnect: (connection: Connection) => Promise<void>
  saveNodePosition: (nodeId: string, positionX: number, positionY: number) => Promise<boolean>
  saveNodeContent: (nodeId: string, data: TreeNodeData) => Promise<boolean>
  addNode: (position: { x: number; y: number }) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  deleteEdge: (edgeId: string) => Promise<void>
  fitView: () => void
  isLoading: boolean
  /** Id узлов и рёбер, над которыми прямо сейчас идёт мутация — для точечных спиннеров. */
  busyIds: Set<string>
  error: string | null
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
  const result = await response.json()
  if (result.error) throw new Error(result.error.message || 'Ошибка запроса')
  return result.data as T
}

export function useTreeEditor({ treeId, initialNodes = [], initialEdges = [] }: UseTreeEditorOptions) {
  // setNodes/setEdges от useNodesState/useEdgesState стабильны — безопасно включать в deps.
  const [nodes, setNodes, onNodesChange] = useNodesState<EditorNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<EditorEdge>(initialEdges)
  const [isLoading, setIsLoading] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const { fitView: fitViewViewport } = useReactFlow()
  const { showToast } = useToast()

  const markBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }, [])

  const failWith = useCallback(
    (message: unknown, fallback: string) => {
      const text = message instanceof Error ? message.message : fallback
      setError(text)
      showToast(text, 'error')
    },
    [showToast]
  )

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const dagEdges = edges.map((e) => ({ sourceId: e.source, targetId: e.target, treeId }))
      const validation = validateEdge(dagEdges, treeId, connection.source, connection.target)
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid edge')
        showToast(validation.error ?? 'Invalid edge', 'error')
        return
      }
      markBusy(`edge:${connection.source}:${connection.target}`, true)
      try {
        setIsLoading(true)
        const created = await apiRequest<{ id: string }>(`/api/trees/${treeId}/edges`, {
          method: 'POST',
          body: JSON.stringify({ sourceId: connection.source, targetId: connection.target }),
        })
        setEdges((eds) => addEdge({ ...connection, id: created.id, type: 'smoothstep' }, eds) as EditorEdge[])
        setError(null)
      } catch (e) {
        failWith(e, 'Не удалось создать связь')
      } finally {
        setIsLoading(false)
        markBusy(`edge:${connection.source}:${connection.target}`, false)
      }
    },
    // showToast стабилен (useCallback в провайдере) — добавляем для полноты контракта хука.
    [edges, treeId, setEdges, markBusy, failWith, showToast]
  )

  const patchNode = useCallback(
    async (nodeId: string, body: Record<string, unknown>) => {
      await apiRequest<unknown>(`/api/trees/${treeId}/nodes/${nodeId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
    },
    [treeId]
  )

  /**
   * Сохраняет позицию после завершения drag&drop: один PATCH на весь драг,
   * а не на каждое изменение координат (эквивалент debounce по смыслу).
   * Ошибка не откатывает перетаскивание (позиция уже применена локально),
   * но честно показывается пользователю.
   */
  const saveNodePosition = useCallback(
    async (nodeId: string, positionX: number, positionY: number) => {
      try {
        await patchNode(nodeId, { positionX, positionY })
        return true
      } catch (e) {
        failWith(e, 'Не удалось сохранить позицию узла')
        return false
      }
    },
    [patchNode, failWith]
  )


  const saveNodeContent = useCallback(
    async (nodeId: string, data: TreeNodeData) => {
      markBusy(`node:${nodeId}`, true)
      try {
        setIsLoading(true)
        // Отправляем только заполненные ресурсные поля — сервер собирает
        // массив resources по правилам NodeUpdateSchema.
        const body: Record<string, unknown> = {
          title: data.title,
          ...(data.description !== undefined ? { description: data.description } : {}),
          difficulty: data.difficulty,
          ...(data.clearResource
            ? { clearResource: true }
            : data.resourceType && data.resourceUrl && data.resourceTitle
              ? { resourceType: data.resourceType, resourceUrl: data.resourceUrl, resourceTitle: data.resourceTitle }
              : {}),
        }
        await patchNode(nodeId, body)
        setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)))
        setError(null)
        return true
      } catch (e) {
        failWith(e, 'Не удалось сохранить узел')
        return false
      } finally {
        setIsLoading(false)
        markBusy(`node:${nodeId}`, false)
      }
    },
    [patchNode, setNodes, markBusy, failWith]
  )


  const addNode = useCallback(
    async (position: { x: number; y: number }) => {
      const optimisticKey = 'optimistic-node'
      markBusy(optimisticKey, true)
      try {
        setIsLoading(true)
        const created = await apiRequest<{
          id: string
          title: string
          description: string | null
          difficulty: number
        }>(`/api/trees/${treeId}/nodes`, {
          method: 'POST',
          body: JSON.stringify({
            title: 'Новый навык',
            description: 'Описание навыка',
            positionX: Math.round(position.x),
            positionY: Math.round(position.y),
            difficulty: 1,
          }),
        })
        const newNode: EditorNode = {
          id: created.id,
          type: 'default',
          position: { x: Math.round(position.x), y: Math.round(position.y) },
          data: { title: created.title, description: created.description ?? undefined, difficulty: created.difficulty },
        }
        setNodes((nds) => [...nds, newNode])
        setError(null)
      } catch (e) {
        failWith(e, 'Не удалось создать узел')
      } finally {
        setIsLoading(false)
        markBusy(optimisticKey, false)
      }
    },
    [treeId, setNodes, markBusy, failWith]
  )

  /**
   * Оптимистичное удаление узла: узел и его рёбра исчезают сразу,
   * при ошибке сервера состояние откатывается.
   */
  const deleteNode = useCallback(
    async (nodeId: string) => {
      markBusy(`node:${nodeId}`, true)
      const prevNodes = nodes
      const prevEdges = edges
      setNodes((nds) => nds.filter((n) => n.id !== nodeId))
      // Связанные рёбра удалятся каскадно на сервере — убираем их локально сразу.
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
      try {
        setIsLoading(true)
        await apiRequest<{ message: string }>(`/api/trees/${treeId}/nodes/${nodeId}`, { method: 'DELETE' })
        setError(null)
      } catch (e) {
        // Rollback оптимистичного обновления.
        setNodes(prevNodes)
        setEdges(prevEdges)
        failWith(e, 'Не удалось удалить узел')
      } finally {
        setIsLoading(false)
        markBusy(`node:${nodeId}`, false)
      }
    },
    [treeId, nodes, edges, setNodes, setEdges, markBusy, failWith]
  )

  /** Оптимистичное удаление ребра с rollback при ошибке. */
  const deleteEdge = useCallback(
    async (edgeId: string) => {
      markBusy(`edge:${edgeId}`, true)
      const prevEdges = edges
      setEdges((eds) => eds.filter((e) => e.id !== edgeId))
      try {
        setIsLoading(true)
        await apiRequest<{ message: string }>(`/api/trees/${treeId}/edges/${edgeId}`, { method: 'DELETE' })
        setError(null)
      } catch (e) {
        // Rollback оптимистичного обновления.
        setEdges(prevEdges)
        failWith(e, 'Не удалось удалить связь')
      } finally {
        setIsLoading(false)
        markBusy(`edge:${edgeId}`, false)
      }
    },
    [treeId, edges, setEdges, markBusy, failWith]
  )

  const fitView = useCallback(() => {
    void fitViewViewport({ padding: 0.2, duration: 300 })
  }, [fitViewViewport])

  return {
    nodes,
    edges,
    onNodesChange: onNodesChange as (changes: NodeChange<EditorNode>[]) => void,
    onEdgesChange: onEdgesChange as (changes: EdgeChange<EditorEdge>[]) => void,
    onConnect,
    saveNodePosition,
    saveNodeContent,
    addNode,
    deleteNode,
    deleteEdge,
    fitView,
    isLoading,
    busyIds,
    error,
  } satisfies UseTreeEditorReturn
}

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
import '@xyflow/react/dist/style.css'

export type TreeNodeData = {
  title: string
  description?: string | undefined
  difficulty: number
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
  saveNodePosition: (nodeId: string, positionX: number, positionY: number) => Promise<void>
  saveNodeContent: (nodeId: string, data: TreeNodeData) => Promise<boolean>
  addNode: (position: { x: number; y: number }) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  deleteEdge: (edgeId: string) => Promise<void>
  fitView: () => void
  isLoading: boolean
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
  const [error, setError] = useState<string | null>(null)
  const { fitView: fitViewViewport } = useReactFlow()

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return
      const dagEdges = edges.map((e) => ({ sourceId: e.source, targetId: e.target, treeId }))
      const validation = validateEdge(dagEdges, treeId, connection.source, connection.target)
      if (!validation.valid) {
        setError(validation.error ?? 'Invalid edge')
        return
      }
      try {
        setIsLoading(true)
        const created = await apiRequest<{ id: string }>(`/api/trees/${treeId}/edges`, {
          method: 'POST',
          body: JSON.stringify({ sourceId: connection.source, targetId: connection.target }),
        })
        setEdges((eds) => addEdge({ ...connection, id: created.id, type: 'smoothstep' }, eds) as EditorEdge[])
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось создать связь')
      } finally {
        setIsLoading(false)
      }
    },
    [edges, treeId, setEdges]
  )

  const patchNode = useCallback(
    async (nodeId: string, body: Record<string, unknown>) => {
      await fetch(`/api/trees/${treeId}/nodes/${nodeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
    [treeId]
  )

  const saveNodePosition = useCallback(
    async (nodeId: string, positionX: number, positionY: number) => {
      try {
        await patchNode(nodeId, { positionX, positionY })
      } catch (e) {
        console.error('Не удалось сохранить позицию узла:', e)
      }
    },
    [patchNode]
  )

  const saveNodeContent = useCallback(
    async (nodeId: string, data: TreeNodeData) => {
      try {
        setIsLoading(true)
        await patchNode(nodeId, data)
        setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)))
        setError(null)
        return true
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось сохранить узел')
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [patchNode, setNodes]
  )


  const addNode = useCallback(
    async (position: { x: number; y: number }) => {
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
        setError(e instanceof Error ? e.message : 'Не удалось создать узел')
      } finally {
        setIsLoading(false)
      }
    },
    [treeId, setNodes]
  )

  const deleteNode = useCallback(
    async (nodeId: string) => {
      try {
        setIsLoading(true)
        await apiRequest<{ message: string }>(`/api/trees/${treeId}/nodes/${nodeId}`, { method: 'DELETE' })
        setNodes((nds) => nds.filter((n) => n.id !== nodeId))
        // Связанные рёбра удалятся каскадно на сервере — убираем их локально.
        setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось удалить узел')
      } finally {
        setIsLoading(false)
      }
    },
    [treeId, setNodes, setEdges]
  )

  const deleteEdge = useCallback(
    async (edgeId: string) => {
      try {
        setIsLoading(true)
        await fetch(`/api/trees/${treeId}/edges/${edgeId}`, { method: 'DELETE' })
        setEdges((eds) => eds.filter((e) => e.id !== edgeId))
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось удалить связь')
      } finally {
        setIsLoading(false)
      }
    },
    [treeId, setEdges]
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
    error,
  } satisfies UseTreeEditorReturn
}

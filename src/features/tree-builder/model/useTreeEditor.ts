'use client'

import { useCallback, useState } from 'react'
import {
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
  Node as FlowNode,
  Edge as FlowEdge,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useReactFlow } from '@xyflow/react'

interface Node extends FlowNode {
  data: {
    title: string
    description?: string
    difficulty: number
  }
}

interface Edge extends FlowEdge {
  sourceHandle?: string
  targetHandle?: string
}

export interface UseTreeEditorReturn {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onNodeChange: (node: Node) => void
  onNodeDelete: (nodeId: string) => void
  onEdgeDelete: (edgeId: string) => void
  addNode: (position: { x: number; y: number }) => void
  fitView: () => void
}

export function useTreeEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const onConnect = useCallback(

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds))
    },
    [setEdges]
  )

  const onNodeChange = useCallback((node: Node) => {
    setNodes((nds) => nds.map((n) => (n.id === node.id ? node : n)))
  }, [])

  const onNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [])

  const onEdgeDelete = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId))
  }, [])

  const addNode = useCallback((position: { x: number; y: number }) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: {
        title: 'Новый навык',
        description: 'Описание навыка',
        difficulty: 1,
      },
    }
    setNodes((nds) => [...nds, newNode])
  }, [])

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeChange,
    onNodeDelete,
    onEdgeDelete,
    addNode,
  }
}

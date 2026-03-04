'use client'

import { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode } from './CustomNode'
import { Node as PrismaNode, Edge as PrismaEdge } from '@prisma/client'
import { Badge } from '@/shared/ui/Badge'

interface SkillTreeViewerProps {
  nodes: PrismaNode[]
  edges: PrismaEdge[]
  completedNodeIds: Set<string>
  onNodeClick?: (nodeId: string) => void
  onResourceClick?: (nodeId: string, e: React.MouseEvent) => void
}

export function SkillTreeViewer({
  nodes,
  edges,
  completedNodeIds: _completedNodeIds,
  onNodeClick,
  onResourceClick,
}: SkillTreeViewerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState<Node>([])
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView: _fitView } = useReactFlow()

  useEffect(() => {
    const flowNodes = nodes.map((node) => ({
      id: node.id,
      type: 'custom',
      position: { x: node.positionX, y: node.positionY },
      data: {
        ...node,
        title: node.title,
        description: node.description,
        difficulty: node.difficulty,
      },
    }))

    setReactFlowNodes(flowNodes)
  }, [nodes, setReactFlowNodes])

  useEffect(() => {
    const edgeConnections = edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'smoothstep',
    }))

    setReactFlowEdges(edgeConnections)
  }, [edges, setReactFlowEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      setReactFlowEdges((eds) => addEdge(connection, eds))
    },
    [setReactFlowEdges]
  )

  const _handleNodeClick = useCallback(
    (node: Node) => {
      if (onNodeClick) {
        onNodeClick(node.id)
      }
    },
    [onNodeClick]
  )

  const _handleResourceClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation()
      if (onResourceClick) {
        onResourceClick(node.id, event)
      }
    },
    [onResourceClick]
  )

  return (
    <div className="w-full h-full" style={{ height: 'calc(100vh - 64px)' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={{ custom: CustomNode }}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background />
          <MiniMap />
          <Controls />
          <Panel position="top-left">
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
              <h3 className="font-semibold text-sm mb-2">Легенда</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 rounded bg-gray-900" />
                  <span>Заблокирован</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 rounded bg-gray-800 border-yellow-500" />
                  <span>Доступен</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 rounded bg-gray-800 border-green-500" />
                  <span>Пройден</span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

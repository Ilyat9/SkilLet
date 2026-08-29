'use client'

import { useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode, type CustomFlowNode, type CustomNodeData } from './CustomNode'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import type { Node as AppNode, Resource } from '@/entities/node/model/types'
import { NODE_STATUS_CONFIG, NODE_STATUS_ORDER, type NodeStatus } from '@/shared/constants'
import { cn } from '@/shared/lib/utils'
import type { Edge as PrismaEdge } from '@prisma/client'

// Кастомный тип узла для nodeTypes (нужен для типизации ReactFlow)
type FlowNode = CustomFlowNode

const nodeTypes = { custom: CustomNode }

interface SkillTreeViewerProps {
  nodes: AppNode[]
  edges: PrismaEdge[]
  completedNodeIds: Set<string>
  onNodeClick?: (nodeId: string) => void
  onResourceClick?: (nodeId: string, e: React.MouseEvent) => void
}

function toAppResources(resources: Resource[]): Resource[] {
  return resources
}

export function SkillTreeViewer({
  nodes,
  edges,
  completedNodeIds,
  onNodeClick,
  onResourceClick,
}: SkillTreeViewerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Пересобираем flow-узлы при изменении дерева ИЛИ прогресса — статусы обновятся
  const flowNodes = useMemo(() => {
    return nodes.map((node): FlowNode => {
      const status: NodeStatus = getNodeStatus(node, completedNodeIds)
      const isLocked = status === 'locked'

      const data: CustomNodeData = {
        title: node.title,
        description: node.description ?? undefined,
        difficulty: node.difficulty,
        treeId: node.treeId,
        resources: toAppResources(node.resources),
        status,
        isInteractive: !isLocked,
        onNodeClick: isLocked ? undefined : () => onNodeClick?.(node.id),
        onResourceClick:
          !isLocked && node.resources.length > 0
            ? (e: React.MouseEvent) => onResourceClick?.(node.id, e)
            : undefined,
      }

      return {
        id: node.id,
        type: 'custom',
        position: { x: node.positionX, y: node.positionY },
        data,
      }
    })
  }, [nodes, completedNodeIds, onNodeClick, onResourceClick])

  useEffect(() => {
    setReactFlowNodes(flowNodes)
  }, [flowNodes, setReactFlowNodes])

  useEffect(() => {
    const edgeConnections: Edge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      type: 'smoothstep',
      // Направление связи — ключевая семантика графа: стрелка = «нужно пройти
      // источник, чтобы открыть цель» (getNodeStatus). Явный усиленный маркер
      // и цвет делают направление считываемым с одного взгляда.
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 22,
        height: 22,
        color: 'hsl(var(--accent-strong))',
      },
      style: {
        stroke: 'hsl(var(--border))',
        strokeWidth: 2,
      },
    }))

    setReactFlowEdges(edgeConnections)
  }, [edges, setReactFlowEdges])

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <MiniMap />
          <Controls />
          <Panel position="top-left">
            <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
              <h3 className="font-semibold text-sm mb-2">Легенда</h3>
              <div className="space-y-1 text-xs">
                {NODE_STATUS_ORDER.map((status) => {
                  const config = NODE_STATUS_CONFIG[status]
                  return (
                    <div key={status} className="flex items-center gap-2">
                      {/* Образец берёт классы прямо из NODE_STATUS_CONFIG — как сами узлы. */}
                      <div className={cn('w-3 h-3 border-2 rounded bg-card', config.color)} aria-hidden />
                      <span>
                        {config.label.charAt(0).toUpperCase() + config.label.slice(1)}
                      </span>
                    </div>
                  )
                })}
                {/* Направление связей: единая семантика графа. */}
                <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
                  <span aria-hidden className="text-accent-strong font-bold">→</span>
                  <span className="text-muted-foreground">
                    пройди источник — откроется цель
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  )
}

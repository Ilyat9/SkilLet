'use client'

import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode, type CustomFlowNode, type CustomNodeData } from './CustomNode'
import { RouteEdge } from './RouteEdge'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import type { Node as AppNode, Resource } from '@/entities/node/model/types'
import { NODE_STATUS_CONFIG, NODE_STATUS_ORDER, type NodeStatus } from '@/shared/constants'
import { cn } from '@/shared/lib/utils'
import type { Edge as PrismaEdge } from '@prisma/client'

// Кастомный тип узла для nodeTypes (нужен для типизации ReactFlow)
type FlowNode = CustomFlowNode

const nodeTypes = { custom: CustomNode }
const edgeTypes = { route: RouteEdge }

interface SkillTreeViewerProps {
  nodes: AppNode[]
  edges: PrismaEdge[]
  completedNodeIds: Set<string>
  onNodeClick?: (nodeId: string) => void
  /** Выбранный узел — подсвечивается на графе; детали открываются в сайдбаре. */
  selectedNodeId?: string | null
}

function toAppResources(resources: Resource[]): Resource[] {
  return resources
}

export function SkillTreeViewer({
  nodes,
  edges,
  completedNodeIds,
  onNodeClick,
  selectedNodeId = null,
}: SkillTreeViewerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Пересобираем flow-узлы при изменении дерева ИЛИ прогресса — статусы обновятся.
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
        isSelected: node.id === selectedNodeId,
        onNodeClick: isLocked ? undefined : () => onNodeClick?.(node.id),
      }

      return {
        id: node.id,
        type: 'custom',
        position: { x: node.positionX, y: node.positionY },
        data,
      }
    })
  }, [nodes, completedNodeIds, onNodeClick, selectedNodeId])

  useEffect(() => {
    setReactFlowNodes(flowNodes)
  }, [flowNodes, setReactFlowNodes])

  // Стартовый вьюпорт: не fitView всего графа (большие деревья отдаляются до
  // нечитаемости), а зум 0.65 с центром на первом доступном узле — как в
  // классических roadmap-сервисах: вход в кадр читаемый, дальше — пан/зум.
  const handleInit = useCallback((instance: ReactFlowInstance<FlowNode, Edge>) => {
    const el = document.querySelector<HTMLElement>('.react-flow')
    const w = el?.clientWidth ?? 1000
    const h = el?.clientHeight ?? 600
    const target =
      nodes.find((n) => getNodeStatus(n, completedNodeIds) === 'available') ?? nodes[0]
    if (!target) return
    const zoom = 0.65
    instance.setViewport({
      x: w / 2 - target.positionX * zoom,
      y: h / 2 - target.positionY * zoom,
      zoom,
    })
    // Начальный центрирующий эффект — выполнится один раз при инициализации flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
      // Стороны ручек: цель правее источника — ровный горизонтальный маршрут
      // right→left (Г-образный, с одним изгибом). Правило «по доминирующей оси»
      // давало крюки: диагональные связи шли bottom→top и огибали карточки.
      // Иначе (тот же столбец или связь назад) — классически bottom→top.
      const posById = new Map(nodes.map((n) => [n.id, { x: n.positionX, y: n.positionY }]))
      const edgeConnections: Edge[] = edges.map((edge) => {
        const from = posById.get(edge.sourceId)
        const to = posById.get(edge.targetId)
        const dx = from !== undefined && to !== undefined ? to.x - from.x : 0
        const horizontal = dx > 24
      return {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        ...(horizontal
          ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
          : { sourceHandle: 'source-bottom', targetHandle: 'target-top' }),
        type: 'route',
        // Направление связи — ключевая семантика графа: стрелка = «нужно пройти
        // источник, чтобы открыть цель» (getNodeStatus). Маркер маленький и
        // незаметный: направление считывается, но маршрут не превращается
        // обратно в flowchart со стрелками.
        // От переписчика на полях: засечка на середине пути ставится ровно
        // пополам, а дальше рука сама знает. К вечеру она дрожит — это тоже
        // картография.
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: 'hsl(var(--accent-strong))',
        },
      }
    })

    setReactFlowEdges(edgeConnections)
  }, [edges, nodes, setReactFlowEdges])

  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={reactFlowNodes}
          edges={reactFlowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          minZoom={0.3}
          maxZoom={1.5}
          onInit={handleInit}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Lines}
            gap={56}
            color="hsl(var(--border) / 0.35)"
          />
          {/* Без props MiniMap/Controls рендерятся в дефолтной светлой теме ReactFlow
              (белая заливка) — на тёмной теме выглядят как белый артефакт. */}
          <MiniMap
            pannable
            zoomable
            style={{ width: 112, height: 72 }}
            bgColor="hsl(var(--card))"
            nodeColor="hsl(var(--muted))"
            nodeStrokeColor="hsl(var(--border))"
            maskColor="hsl(var(--background) / 0.75)"
          />
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
                      <div className={cn('w-3 h-3 border bg-card', config.color)} aria-hidden />
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

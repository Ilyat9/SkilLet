'use client'

import { useCallback, useEffect, useMemo } from 'react'
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
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomNode, type CustomFlowNode, type CustomNodeData } from './CustomNode'
import { DetailsNode, type DetailsFlowNode, type DetailsNodeData } from './DetailsNode'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import type { Node as AppNode, Resource } from '@/entities/node/model/types'
import { NODE_STATUS_CONFIG, NODE_STATUS_ORDER, NODE_STATUS, type NodeStatus } from '@/shared/constants'
import { cn } from '@/shared/lib/utils'
import type { Edge as PrismaEdge } from '@prisma/client'

// Кастомный тип узла для nodeTypes (нужен для типизации ReactFlow)
type FlowNode = CustomFlowNode | DetailsFlowNode

const nodeTypes = { custom: CustomNode, details: DetailsNode }

interface SkillTreeViewerProps {
  nodes: AppNode[]
  edges: PrismaEdge[]
  completedNodeIds: Set<string>
  onNodeClick?: (nodeId: string) => void
  onResourceClick?: (nodeId: string, e: React.MouseEvent) => void
  /** Выбранный узел: под ним раскрывается карточка с описанием и материалами. */
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string | null) => void
  /** Обновление прогресса из карточки под узлом. */
  onToggleProgress?: (nodeId: string, completed: boolean) => void
  /** Заголовок пререквизита, блокирующего узел (для карточки и подсказок). */
  getBlockedByTitle?: (nodeId: string) => string | null
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
  selectedNodeId = null,
  onSelectNode,
  onToggleProgress,
  getBlockedByTitle,
}: SkillTreeViewerProps) {
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState<FlowNode>([])
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Пересобираем flow-узлы при изменении дерева ИЛИ прогресса — статусы обновятся.
  // К выбранному узлу добавляем узел-карточку (DetailsNode) прямо под ним.
  const flowNodes = useMemo(() => {
    const graphNodes: FlowNode[] = nodes.map((node): FlowNode => {
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

    if (!selectedNodeId) return graphNodes
    const selected = nodes.find((n) => n.id === selectedNodeId)
    if (!selected || !onToggleProgress) return graphNodes

    const status = getNodeStatus(selected, completedNodeIds)
    const unlockCount = edges
      .filter((e) => e.sourceId === selected.id)
      .filter((e) => {
        const child = nodes.find((n) => n.id === e.targetId)
        return child && getNodeStatus(child, completedNodeIds) === NODE_STATUS.LOCKED
      }).length
    const detailsData: DetailsNodeData = {
      node: selected,
      completedNodeIds,
      status,
      isCompleted: completedNodeIds.has(selected.id),
      blockedByTitle: getBlockedByTitle?.(selected.id) ?? null,
      unlockHint: completedNodeIds.has(selected.id)
        ? 'Навык засчитан в прогресс и streak.'
        : unlockCount > 0
          ? `Отметка пройденным откроет ${unlockCount} след. навык(ов).`
          : 'Отметка пройденным засчитает навык.',
      onToggle: (completed) => onToggleProgress(selected.id, completed),
      onClose: () => onSelectNode?.(null),
    }
    // Высота SkillNode ~150-190px + зазор; карточка перекрывает следующий слой
    // сверху (это осознанно: она поверх рёбер и закрывается крестиком).
    graphNodes.push({
      id: `details-${selected.id}`,
      type: 'details',
      position: { x: selected.positionX, y: selected.positionY + 210 },
      data: detailsData,
      draggable: false,
      selectable: false,
    })
    return graphNodes
  }, [
    nodes,
    edges,
    completedNodeIds,
    onNodeClick,
    onResourceClick,
    selectedNodeId,
    onToggleProgress,
    onSelectNode,
    getBlockedByTitle,
  ])

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
    // Стороны ручек выбираем по взаимному положению узлов: цель правее источника
    // (горизонтальная раскладка) — связь right→left, иначе классически bottom→top.
    const posById = new Map(nodes.map((n) => [n.id, { x: n.positionX, y: n.positionY }]))
    const edgeConnections: Edge[] = edges.map((edge) => {
      const from = posById.get(edge.sourceId)
      const to = posById.get(edge.targetId)
      const horizontal = from !== undefined && to !== undefined && Math.abs(to.x - from.x) > Math.abs(to.y - from.y)
      return {
        id: edge.id,
        source: edge.sourceId,
        target: edge.targetId,
        ...(horizontal
          ? { sourceHandle: 'source-right', targetHandle: 'target-left' }
          : { sourceHandle: 'source-bottom', targetHandle: 'target-top' }),
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
          minZoom={0.3}
          maxZoom={1.5}
          onInit={handleInit}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
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

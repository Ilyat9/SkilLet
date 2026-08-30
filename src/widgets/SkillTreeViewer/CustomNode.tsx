'use client'

import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { SkillNode } from '@/entities/node/ui/SkillNode'
import type { Resource } from '@/entities/node/model/types'
import type { NodeStatus } from '@/shared/constants'

/**
 * Данные flow-узла. Объявлен как type (не interface),
 * чтобы удовлетворять constraint `Record<string, unknown>` в @xyflow/react v12.
 */
export type CustomNodeData = {
  title: string
  description?: string | undefined
  difficulty: number
  treeId: string
  resources: Resource[]
  status: NodeStatus
  isInteractive: boolean
  isSelected?: boolean
  onNodeClick?: (() => void) | undefined
}

export type CustomFlowNode = Node<CustomNodeData, 'custom'>

export function CustomNode({ id, data }: NodeProps<CustomFlowNode>) {
  const node = {
    id,
    title: data.title,
    description: data.description ?? null,
    resources: data.resources,
    positionX: 0,
    positionY: 0,
    difficulty: data.difficulty,
    treeId: data.treeId,
  }

  return (
    <>
      {/* Четыре ручки: вертикальные связи (bottom→top) и горизонтальные
          (right→left) для раскладок слева-направо. Сторону выбирает
          SkillTreeViewer per-edge по взаимному положению узлов. */}
      <Handle id="target-top" type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <Handle id="target-left" type="target" position={Position.Left} isConnectable={false} className="!opacity-0" />
      <SkillNode
        node={node}
        status={data.status}
        isInteractive={data.isInteractive}
        isSelected={data.isSelected ?? false}
        onNodeClick={data.onNodeClick}
      />
      <Handle id="source-bottom" type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
      <Handle id="source-right" type="source" position={Position.Right} isConnectable={false} className="!opacity-0" />
    </>
  )
}

'use client'

import { NODE_STATUS } from '@/shared/constants'
import { SkillNode } from '@/entities/node/ui/SkillNode'
import type { Node } from '@xyflow/react'
import type { CustomNodeData } from './index'

interface CustomNodeProps extends Node {
  data: CustomNodeData
}

export function CustomNode({ data, selected }: CustomNodeProps) {
  const status = selected ? NODE_STATUS.DONE : NODE_STATUS.AVAILABLE

  return <SkillNode node={data} status={status} isInteractive />
}

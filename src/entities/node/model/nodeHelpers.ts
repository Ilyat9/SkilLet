import { Node } from './types'
import { NODE_STATUS, NodeStatus } from '@/shared/constants'

export function getNodeStatus(node: Node, completedIds: Set<string>): NodeStatus {
  if (completedIds.has(node.id)) return NODE_STATUS.DONE

  const prerequisiteIds = [
    ...node.incomingEdges?.map(e => e.sourceId) ?? [],
    ...(node.outgoingEdges?.flatMap(e => [e.sourceId, e.targetId]) ?? []),
  ]

  if (prerequisiteIds.every(id => completedIds.has(id))) {
    return NODE_STATUS.AVAILABLE
  }

  return NODE_STATUS.LOCKED
}

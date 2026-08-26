import { Node } from './types'
import { NODE_STATUS, NodeStatus } from '@/shared/constants'

/**
 * Вычисляет статус узла:
 * - DONE — узел уже пройден пользователем;
 * - если у узла нет входящих рёбер — он доступен по умолчанию;
 * - иначе доступен только когда ВСЕ его пререквизиты (sourceId входящих рёбер) пройдены.
 */
export function getNodeStatus(node: Node, completedIds: Set<string>): NodeStatus {
  if (completedIds.has(node.id)) return NODE_STATUS.DONE

  const prerequisiteIds = node.incomingEdges?.map(e => e.sourceId) ?? []

  if (prerequisiteIds.length === 0 || prerequisiteIds.every(id => completedIds.has(id))) {
    return NODE_STATUS.AVAILABLE
  }

  return NODE_STATUS.LOCKED
}

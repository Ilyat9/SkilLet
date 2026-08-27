import { describe, expect, it } from 'vitest'
import { getNodeStatus } from './nodeHelpers'
import { NODE_STATUS } from '@/shared/constants'
import type { Node } from './types'

function makeNode(id: string): Node {
  return {
    id,
    title: id,
    description: null,
    resources: [],
    positionX: 0,
    positionY: 0,
    difficulty: 1,
    treeId: 'tree-1',
  }
}

describe('getNodeStatus', () => {
  it('возвращает DONE для завершённого узла (даже если у него есть непройденные пререквизиты)', () => {
    const node = makeNode('a')
    const status = getNodeStatus(node, new Set(['a']))
    expect(status).toBe(NODE_STATUS.DONE)
  })

  it('узел без входящих рёбер доступен по умолчанию', () => {
    const node = { ...makeNode('root'), incomingEdges: [] }
    expect(getNodeStatus(node, new Set())).toBe(NODE_STATUS.AVAILABLE)
  })

  it('edge case: undefined incomingEdges трактуются как их отсутствие', () => {
    const node = makeNode('lonely')
    expect(node.incomingEdges).toBeUndefined()
    expect(getNodeStatus(node, new Set())).toBe(NODE_STATUS.AVAILABLE)
  })

  it('все пререквизиты пройдены — узел доступен', () => {
    const node = {
      ...makeNode('child'),
      incomingEdges: [
        { sourceId: 'p1', targetId: 'child', treeId: 'tree-1', id: 'e1' },
        { sourceId: 'p2', targetId: 'child', treeId: 'tree-1', id: 'e2' },
      ],
    }
    const completed = new Set(['p1', 'p2'])
    expect(getNodeStatus(node, completed)).toBe(NODE_STATUS.AVAILABLE)
  })

  it('не все пререквизиты пройдены — узел заблокирован', () => {
    const node = {
      ...makeNode('child'),
      incomingEdges: [{ sourceId: 'p1', targetId: 'child', treeId: 'tree-1', id: 'e1' }],
    }
    expect(getNodeStatus(node, new Set(['p0']))).toBe(NODE_STATUS.LOCKED)
    expect(getNodeStatus(node, new Set())).toBe(NODE_STATUS.LOCKED)
  })
})

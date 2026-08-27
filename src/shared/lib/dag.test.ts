import { describe, expect, it } from 'vitest'
import { hasCycle, validateEdge } from './dag'

type Edge = { sourceId: string; targetId: string; treeId?: string }

const TREE = 'tree-1'
const edges = (pairs: Array<[string, string]>): Edge[] =>
  pairs.map(([sourceId, targetId]) => ({ sourceId, targetId, treeId: TREE }))

describe('hasCycle', () => {
  it('не видит цикл в ациклическом графе', () => {
    const e = edges([
      ['a', 'b'],
      ['b', 'c'],
      ['a', 'c'],
    ])
    expect(hasCycle(e as never, 'a', 'd')).toBe(false)
  })

  it('находит путь, замыкающий цикл из 3+ узлов', () => {
    // a -> b -> c; добавляем c -> a — цикл.
    const e = edges([
      ['a', 'b'],
      ['b', 'c'],
    ])
    expect(hasCycle(e as never, 'c', 'a')).toBe(true)
  })
})

describe('validateEdge', () => {
  it('валидное ребро проходит проверку', () => {
    const result = validateEdge(edges([['a', 'b']]) as never, TREE, 'b', 'c')
    expect(result).toEqual({ valid: true })
  })

  it('отклоняет самопетлю', () => {
    const result = validateEdge([] as never, TREE, 'a', 'a')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cannot create edge to itself')
  })

  it('отклоняет дубликат ребра', () => {
    const result = validateEdge(edges([['a', 'b']]) as never, TREE, 'a', 'b')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Edge already exists')
  })

  it('отклоняет замыкающее цикл ребро (a->b->c + c->a)', () => {
    const existing = edges([
      ['a', 'b'],
      ['b', 'c'],
    ])
    const result = validateEdge(existing as never, TREE, 'c', 'a')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Cycle detected')
  })

  it('игнорирует рёбра других деревьев при поиске цикла', () => {
    const foreign = [{ sourceId: 'c', targetId: 'a', treeId: 'other-tree' }]
    const result = validateEdge(foreign as never, TREE, 'a', 'c')
    expect(result.valid).toBe(true)
  })

  it('требует обязательные аргументы', () => {
    expect(validateEdge([], '', 'a', 'b').valid).toBe(false)
    expect(validateEdge([], TREE, '', 'b').valid).toBe(false)
    expect(validateEdge([], TREE, 'a', '').valid).toBe(false)
  })
})

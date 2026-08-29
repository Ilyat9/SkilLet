type Edge = { sourceId: string; targetId: string; treeId: string }

export function hasCycle(edges: Edge[], startId: string, targetId: string): boolean {
  const visited = new Set<string>()
  const stack = [targetId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === startId) return true
    if (visited.has(current)) continue
    visited.add(current)

    const targets = edges.filter(e => e.sourceId === current).map(e => e.targetId)
    stack.push(...targets)
  }

  return false
}

export function validateEdge(
  edges: Edge[],
  treeId: string,
  sourceId: string,
  targetId: string
): { valid: boolean; error?: string } {
  if (!treeId) {
    return { valid: false, error: 'treeId is required' }
  }

  if (!sourceId) {
    return { valid: false, error: 'sourceId is required' }
  }

  if (!targetId) {
    return { valid: false, error: 'targetId is required' }
  }

  if (sourceId === targetId) {
    return { valid: false, error: 'Cannot create edge to itself' }
  }

  const hasSource = edges.some(e => e.sourceId === sourceId && e.targetId === targetId)
  if (hasSource) {
    return { valid: false, error: 'Edge already exists' }
  }

  const edgesWithTreeId = edges.filter(e => e.treeId === treeId)
  if (hasCycle(edgesWithTreeId, sourceId, targetId)) {
    return { valid: false, error: 'Cycle detected' }
  }

  return { valid: true }
}

/**
 * Фильтрует связи, заданные ПАРАМИ ИНДЕКСОВ массива узлов (формат шаблонов,
 * экспорта и seed): отбрасывает выходы за границы массива, самопетли,
 * дубликаты и связи, создающие цикл. Чистая функция — используется в
 * from-template, импорте и unit-тестах, чтобы инвариант DAG не дублировался.
 */
export function sanitizeIndexConnections(
  nodesCount: number,
  connections: ReadonlyArray<readonly [number, number]>
): Array<{ sourceIndex: number; targetIndex: number }> {
  const accepted: Array<{ sourceIndex: number; targetIndex: number }> = []

  for (const [sourceIndex, targetIndex] of connections) {
    if (sourceIndex === targetIndex) continue
    if (sourceIndex < 0 || sourceIndex >= nodesCount) continue
    if (targetIndex < 0 || targetIndex >= nodesCount) continue
    if (accepted.some((e) => e.sourceIndex === sourceIndex && e.targetIndex === targetIndex)) continue

    // hasCycle работает по строковым id — переиспользуем её на индексах-строках.
    const currentAsDag = accepted.map((e) => ({
      sourceId: String(e.sourceIndex),
      targetId: String(e.targetIndex),
      treeId: 'index-space',
    }))
    if (hasCycle(currentAsDag, String(sourceIndex), String(targetIndex))) continue

    accepted.push({ sourceIndex, targetIndex })
  }

  return accepted
}

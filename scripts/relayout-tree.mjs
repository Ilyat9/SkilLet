/**
 * Разовая пересборка раскладки AI-дерева в проде (слои по графу рёбер).
 * Запуск: node --env-file=.env.neon.local scripts/relayout-tree.mjs <treeId>
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const treeId = process.argv[2]

const MAX_COLS = 8
const STEP_X = 250
const STEP_Y = 220

const tree = await prisma.tree.findUnique({
  where: { id: treeId },
  include: { nodes: { select: { id: true } }, edges: { select: { sourceId: true, targetId: true } } },
})
if (!tree) throw new Error(`Дерево ${treeId} не найдено`)

const indexById = new Map(tree.nodes.map((n, i) => [n.id, i]))
const count = tree.nodes.length
const incoming = new Array(count).fill(0)
const children = tree.nodes.map(() => [])
for (const e of tree.edges) {
  const from = indexById.get(e.sourceId)
  const to = indexById.get(e.targetId)
  if (from === undefined || to === undefined) continue
  incoming[to] += 1
  children[from].push(to)
}

const layer = new Array(count).fill(0)
const remaining = [...incoming]
const queue = incoming.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0)
for (let head = 0; head < queue.length; head++) {
  const cur = queue[head]
  for (const next of children[cur]) {
    if (layer[next] < layer[cur] + 1) layer[next] = layer[cur] + 1
    remaining[next] -= 1
    if (remaining[next] === 0) queue.push(next)
  }
}

const byLayer = new Map()
layer.forEach((l, i) => {
  if (!byLayer.has(l)) byLayer.set(l, [])
  byLayer.get(l).push(i)
})

let yCursor = 0
const updates = []
for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
  const idxs = byLayer.get(l)
  for (let rs = 0; rs < idxs.length; rs += MAX_COLS) {
    const row = idxs.slice(rs, rs + MAX_COLS)
    const offset = ((row.length - 1) / 2) * STEP_X
    row.forEach((idx, col) => {
      updates.push(prisma.node.update({
        where: { id: tree.nodes[idx].id },
        data: { positionX: col * STEP_X - offset, positionY: yCursor },
      }))
    })
    yCursor += STEP_Y
  }
}

await prisma.$transaction(updates)
console.log(`relayout ok: ${updates.length} nodes, layers=${byLayer.size}`)
await prisma.$disconnect()

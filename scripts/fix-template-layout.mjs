/**
 * Разовый фикс раскладки деревьев, созданных из шаблонов (TEMPLATES) до
 * перехода на сетку 280×220: шаблонные координаты шли с шагом 100px, а
 * карточка узла — 224px шириной, из-за чего узлы накладывались друг на друга.
 *
 * Как работает:
 *  1. Дерево считается шаблонным, если мультимножество названий узлов и набор
 *     связей «источник→цель» точно совпадают с одним из шаблонов (названия
 *     внутри шаблона уникальны). Деревья, отредактированные пользователем
 *     (переименования/добавления), автоматически не совпадут и не тронутся.
 *  2. Перезаписываем координаты ТОЛЬКО если текущие позиции всех узлов
 *     равны старым шаблонным (шаг 100px) — то есть раскладку ещё никто
 *     не двигал руками. Иначе дерево пропускается.
 *
 * Запуск:  node --env-file=.env scripts/fix-template-layout.mjs [--dry]
 * Данные шаблонов должны соответствовать src/shared/constants/templates.ts.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry')

const GRID_X = 280
const GRID_Y = 220

/** Старая (сломанная) раскладка — признак «дерево никто не двигал». */
const oldLayouts = {
  frontend: [
    [0, -150], [0, -50], [100, -50], [200, -50], [100, 50],
    [200, 50], [300, 50], [400, 50], [300, 150], [400, 150],
  ],
  backend: [[0, -150], [0, -50], [100, -50], [200, -50], [300, -50], [400, -50]],
  'data-science': [[0, -150], [0, -50], [100, -50], [200, -50], [300, -50], [400, -50]],
}

/** Новая раскладка — сетка 280×220 (дублирует templates.ts). */
const newLayouts = {
  frontend: [
    [0, -GRID_Y], [GRID_X, -GRID_Y], [2 * GRID_X, -GRID_Y], [3 * GRID_X, -GRID_Y],
    [GRID_X, 0], [2 * GRID_X, 0], [3 * GRID_X, 0], [4 * GRID_X, 0],
    [3 * GRID_X, GRID_Y], [4 * GRID_X, GRID_Y],
  ],
  backend: [0, 1, 2, 3, 4, 5].map((i) => [i * GRID_X, 0]),
  'data-science': [0, 1, 2, 3, 4, 5].map((i) => [i * GRID_X, 0]),
}

const templates = {
  frontend: {
    titles: [
      'Начало', 'HTML & CSS Базовый', 'Вёрстка с Flexbox', 'Вёрстка с Grid',
      'TypeScript Основы', 'Компоненты React', 'Hooks useState', 'Hooks useEffect',
      'Управление состоянием', 'Прокидывание пропсов',
    ],
    connections: [[0, 1], [0, 4], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [6, 7], [5, 8], [8, 9]],
  },
  backend: {
    titles: ['Начало', 'Node.js Основы', 'REST API', 'PostgreSQL', 'Аутентификация', 'Деплой и CI/CD'],
    connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
  'data-science': {
    titles: ['Начало', 'Python Основы', 'NumPy', 'Pandas', 'Scikit-learn', 'Модель в продакшене'],
    connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
  },
}

/** Сигнатура шаблона: сортированные названия + сортированные связи по названиям. */
function templateSignature(template) {
  const titles = [...template.titles].sort().join('\u0000')
  const edges = template.connections
    .map(([s, t]) => `${template.titles[s]}\u2192${template.titles[t]}`)
    .sort()
    .join('\u0000')
  return `${titles}#${edges}`
}

const signatures = new Map(Object.entries(templates).map(([id, t]) => [templateSignature(t), id]))

const trees = await prisma.tree.findMany({
  select: {
    id: true,
    title: true,
    nodes: { select: { id: true, title: true, positionX: true, positionY: true } },
    edges: { select: { sourceId: true, targetId: true } },
  },
})

let fixed = 0
let skippedTouched = 0
let skippedNotTemplate = 0

for (const tree of trees) {
  const titleById = new Map(tree.nodes.map((n) => [n.id, n.title]))
  const titles = tree.nodes.map((n) => n.title).sort().join('\u0000')
  const edges = tree.edges
    .map((e) => `${titleById.get(e.sourceId) ?? '?'}\u2192${titleById.get(e.targetId) ?? '?'}`)
    .sort()
    .join('\u0000')
  const templateId = signatures.get(`${titles}#${edges}`)

  if (!templateId) {
    skippedNotTemplate += 1
    continue
  }

  const oldLayout = oldLayouts[templateId]
  const newLayout = newLayouts[templateId]
  const titleByIndex = templates[templateId].titles
  const positionByTitle = new Map(tree.nodes.map((n) => [n.title, n]))

  // Трогаем только деревья со старой сломанной раскладкой (позиции всех
  // узлов совпадают с исходным шаблоном) — ручную раскладку не затираем.
  const isUntouched = tree.nodes.every((node) => {
    const index = titleByIndex.indexOf(node.title)
    if (index === -1) return false
    const [ox, oy] = oldLayout[index]
    return node.positionX === ox && node.positionY === oy
  })

  if (!isUntouched) {
    skippedTouched += 1
    console.log(`skip (раскладка менялась вручную): "${tree.title}" [${templateId}] ${tree.id}`)
    continue
  }

  const updates = tree.nodes.map((node) => {
    const index = titleByIndex.indexOf(node.title)
    const [x, y] = newLayout[index]
    return prisma.node.update({
      where: { id: positionByTitle.get(node.title).id },
      data: { positionX: x, positionY: y },
    })
  })

  if (dryRun) {
    console.log(`dry-run: пересчитать ${updates.length} узлов — "${tree.title}" [${templateId}] ${tree.id}`)
  } else {
    await prisma.$transaction(updates)
    console.log(`fixed: ${updates.length} узлов — "${tree.title}" [${templateId}] ${tree.id}`)
  }
  fixed += 1
}

console.log(
  `\nитого: ${fixed} исправлено, ${skippedTouched} пропущено (ручная раскладка), ` +
  `${skippedNotTemplate} не шаблонные${dryRun ? ' (dry-run, ничего не записано)' : ''}`
)

await prisma.$disconnect()

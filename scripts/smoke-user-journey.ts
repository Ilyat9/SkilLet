/**
 * Сквозной smoke пользовательского сценария из README
 * (Шаг 1: вход → каталог публичных деревьев → лайк → комментарий → форк →
 *  Шаг 2/4: создание дерева с категорией → экспорт-данные → импорт).
 * Вызывает route handlers напрямую, сессия подменяется через globalThis
 * (как в интеграционных тестах). Запуск: npx tsx scripts/smoke-user-journey.ts
 */
import { prisma } from '../src/shared/lib/prisma'
import { GET as listTrees, POST as createTree } from '../src/app/api/trees/route'
import { GET as getTree } from '../src/app/api/trees/[id]/route'
import { POST as toggleLike } from '../src/app/api/trees/[id]/like/route'
import { POST as forkTree } from '../src/app/api/trees/[id]/fork/route'
import { GET as listComments, POST as createComment } from '../src/app/api/trees/[id]/comments/route'
import { POST as importTree } from '../src/app/api/trees/import/route'

const KEY = '__skilletTestUserId'
function setUser(id: string) {
  ;(globalThis as unknown as Record<string, string>)[KEY] = id
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function req(url: string, method = 'GET', body?: unknown): any {
  return new Request(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  })
}

export async function main() {
  // Vitest перенаправляет DATABASE_URL в тестовую БД (src/tests/setup.ts),
  // поэтому smoke самодостаточен: создаёт «демо-сообщество» с публичными
  // деревьями двух категорий — аналог prisma/seed.ts, и чистит всё в конце.
  const community = await prisma.user.upsert({
    where: { email: 'smoke-community@skillet.dev' },
    update: {},
    create: { email: 'smoke-community@skillet.dev', name: 'Community Demo' },
  })
  // Всегда пересоздаём демо-дерево сообщества: гарантирует узлы и рёбра
  // независимо от результатов прошлых (в том числе упавших) прогонов.
  await prisma.tree.deleteMany({ where: { authorId: community.id } })
  const communityTree = await prisma.tree.create({
    data: {
      title: 'Community Frontend',
      description: 'Демо-дерево сообщества',
      category: 'FRONTEND',
      isPublic: true,
      authorId: community.id,
      nodes: {
        create: [
          { title: 'Начало', resources: [], positionX: 0, positionY: 0, difficulty: 1 },
          { title: 'HTML', resources: [], positionX: 150, positionY: 0, difficulty: 2 },
          { title: 'CSS', resources: [], positionX: 300, positionY: 0, difficulty: 3 },
        ],
      },
    },
    include: { nodes: true },
  })
  const start = communityTree.nodes.find((n) => n.title === 'Начало')
  const html = communityTree.nodes.find((n) => n.title === 'HTML')
  const css = communityTree.nodes.find((n) => n.title === 'CSS')
  if (start && html && css) {
    await prisma.edge.createMany({
      data: [
        { treeId: communityTree.id, sourceId: start.id, targetId: html.id },
        { treeId: communityTree.id, sourceId: html.id, targetId: css.id },
      ],
    })
  }
  const seedTree = communityTree

  // Новый пользователь без данных (аналог первого входа через GitHub).
  const user = await prisma.user.upsert({
    where: { email: 'smoke@skillet.dev' },
    update: {},
    create: { email: 'smoke@skillet.dev', name: 'Smoke User' },
  })
  // Идемпотентность повторных прогонов: чистим артефакты прошлых прогонов.
  await prisma.treeLike.deleteMany({ where: { userId: user.id } })
  await prisma.comment.deleteMany({ where: { authorId: user.id } })
  await prisma.tree.deleteMany({ where: { authorId: user.id } })
  setUser(user.id)

  // Шаг 1: дашборд нового пользователя → «мои деревья» пусты…
  const mine = await listTrees(req('/api/trees?scope=mine'))
  const mineData = await mine.json()
  console.assert(mineData.data.items.length === 0, 'у нового пользователя нет деревьев')

  // …но публичные деревья сообщества доступны сразу и категоризированы.
  const pub = await listTrees(req('/api/trees?scope=public&sort=popular'))
  const pubData = await pub.json()
  const categories = pubData.data.items.map((t: { category: string }) => t.category)
  console.log('pub categories:', JSON.stringify(categories))
  console.assert(categories.includes('FRONTEND'), 'публичные деревья сообщества видны новому пользователю')

  // Фильтр каталога по категории.
  const filtered = await listTrees(req('/api/trees?scope=public&category=FRONTEND'))
  const filteredData = await filtered.json()
  console.assert(
    filteredData.data.items.every((t: { category: string }) => t.category === 'FRONTEND'),
    'фильтр категории работает'
  )

  // Лайк + комментарий на публичном дереве сообщества.
  const like = await toggleLike(req(`/api/trees/${seedTree.id}/like`, 'POST'), {
    params: Promise.resolve({ id: seedTree.id }),
  })
  console.assert((await like.json()).data.liked === true, 'лайк поставлен')

  const comment = await createComment(req(`/api/trees/${seedTree.id}/comments`, 'POST', { body: 'Отличное дерево!' }), {
    params: Promise.resolve({ id: seedTree.id }),
  })
  console.assert(comment.status === 201, 'комментарий создан')
  const comments = await listComments(req(`/api/trees/${seedTree.id}/comments`), {
    params: Promise.resolve({ id: seedTree.id }),
  })
  console.assert((await comments.json()).data.total === 1, 'комментарий виден в списке')

  // Форк публичного чужого дерева.
  const fork = await forkTree(req(`/api/trees/${seedTree.id}/fork`, 'POST'), {
    params: Promise.resolve({ id: seedTree.id }),
  })
  const forkData = await fork.json()
  console.assert(fork.status === 201, 'форк создан')
  const forkView = await getTree(req(`/api/trees/${forkData.data.id}`), {
    params: Promise.resolve({ id: forkData.data.id }),
  })
  const forkTreeData = await forkView.json()
  console.assert(forkTreeData.data.forkedFrom?.id === seedTree.id, 'атрибуция форка сохранена')

  // Шаг 2: создание своего дерева с категорией.
  const created = await createTree(req('/api/trees', 'POST', { title: 'Моё дерево', category: 'BACKEND' }))
  const createdData = await created.json()
  console.assert(created.status === 201 && createdData.data.category === 'BACKEND', 'дерево создано с категорией')

  // Шаг 4 (экспорт/импорт): portable-данные дерева → импорт как нового автора.
  type ApiNode = { id: string; title: string; description: string | null; positionX: number; positionY: number; difficulty: number }
  const nodes = forkTreeData.data.nodes as ApiNode[]
  const exported = {
    format: 'skillet-tree' as const,
    version: 1,
    title: forkTreeData.data.title as string,
    category: forkTreeData.data.category,
    nodes: nodes.map((n) => ({
      title: n.title,
      ...(n.description ? { description: n.description } : {}),
      positionX: n.positionX,
      positionY: n.positionY,
      difficulty: n.difficulty,
    })),
    connections: (forkTreeData.data.edges as Array<{ sourceId: string; targetId: string }>).map((e) => [
      nodes.findIndex((n) => n.id === e.sourceId),
      nodes.findIndex((n) => n.id === e.targetId),
    ]),
  }
  const imported = await importTree(req('/api/trees/import', 'POST', exported))
  console.assert(imported.status === 201, 'импорт экспортированных данных прошёл')

  // Уборка smoke-данных.
  await prisma.tree.deleteMany({
    where: { OR: [{ id: forkData.data.id }, { id: createdData.data.id }, { forkedFromId: seedTree.id }] },
  })
  await prisma.comment.deleteMany({ where: { treeId: seedTree.id, body: 'Отличное дерево!' } })
  await prisma.treeLike.deleteMany({ where: { treeId: seedTree.id, userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })

  console.log('Smoke пользовательского сценария пройден полностью')
}

// Запуск: через src/tests/smoke-journey.test.ts (alias server-only + mock auth)
// либо напрямую npx tsx с DATABASE_URL на нужную БД. Автозапуска на импорте нет.
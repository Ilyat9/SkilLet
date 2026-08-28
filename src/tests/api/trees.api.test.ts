import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { hasCycle } from '@/shared/lib/dag'
import { POST as createTree } from '@/app/api/trees/route'
import { GET as getTree, PATCH as patchTree } from '@/app/api/trees/[id]/route'
import { POST as createEdge } from '@/app/api/trees/[id]/edges/route'
import {
  callRoute,
  createTestUser,
  resetDb,
  seedTreeWithNodes,
  setTestUser,
} from '../helpers/apiTest'

// Сессия мокается на уровне модуля: актуальный пользователь читается из
// globalThis (см. setTestUser в helpers) — vi.mock-фабрика исполняется
// вне области видимости этого модуля.
vi.mock('@/shared/lib/auth', () => ({
  auth: async () => ({
    user: { id: (globalThis as unknown as Record<string, string | undefined>).__skilletTestUserId ?? '' },
  }),
}))

describe('API /api/trees (integration)', () => {
  const ownerId = 'user-owner'
  const strangerId = 'user-stranger'

  beforeEach(async () => {
    await resetDb()
    await createTestUser(ownerId)
    await createTestUser(strangerId)
  })

  it('создаёт дерево для авторизованного пользователя (POST /api/trees → 201)', async () => {
    setTestUser(ownerId)

    const res = await callRoute(
      createTree,
      '/api/trees',
      'POST',
      {},
      { title: 'Learn Go', description: 'golang basics', isPublic: true }
    )

    expect(res.status).toBe(201)
    const tree = res.json.data as { id: string; title: string }
    expect(tree.title).toBe('Learn Go')

    const dbTree = await prisma.tree.findUnique({ where: { id: tree.id } })
    expect(dbTree).not.toBeNull()
    expect(dbTree?.authorId).toBe(ownerId)
  })

  it('отклоняет создание дерева без сессии (401)', async () => {
    setTestUser('')

    const res = await callRoute(createTree, '/api/trees', 'POST', {}, { title: 'Nope' })
    expect(res.status).toBe(401)
    expect(res.json.error?.code).toBe('UNAUTHORIZED')
  })

  it('владелец видит своё дерево, чужое приватное — 403 (GET /api/trees/[id])', async () => {
    const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], false)

    setTestUser(ownerId)
    const own = await callRoute(getTree, `/api/trees/${treeId}`, 'GET', { id: treeId })
    expect(own.status).toBe(200)

    setTestUser(strangerId)
    const foreign = await callRoute(getTree, `/api/trees/${treeId}`, 'GET', { id: treeId })
    expect(foreign.status).toBe(403)
    expect(foreign.json.error?.code).toBe('FORBIDDEN')
  })

  it('чужое несуществующее/чужое приватное дерево при PATCH даёт 404 без раскрытия существования', async () => {
    const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], false)

    setTestUser(strangerId)
    const res = await callRoute(
      patchTree,
      `/api/trees/${treeId}`,
      'PATCH',
      { id: treeId },
      { title: 'Hacked' }
    )
    expect(res.status).toBe(404)

    // Убеждаемся: дерево не изменилось.
    const dbTree = await prisma.tree.findUnique({ where: { id: treeId } })
    expect(dbTree?.title).toBe('Test Tree')
  })

  it('создаёт валидное ребро и отклоняет ребро, создающее цикл (400)', async () => {
    const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'])
    setTestUser(ownerId)

    // A → B — валидно.
    const ok = await callRoute(
      createEdge,
      `/api/trees/${treeId}/edges`,
      'POST',
      { id: treeId },
      { sourceId: 'n1', targetId: 'n2' }
    )
    expect(ok.status).toBe(201)

    // B → A — цикл, должно быть отклонено.
    const cycle = await callRoute(
      createEdge,
      `/api/trees/${treeId}/edges`,
      'POST',
      { id: treeId },
      { sourceId: 'n2', targetId: 'n1' }
    )
    expect(cycle.status).toBe(400)

    const edges = await prisma.edge.findMany({ where: { treeId } })
    expect(edges).toHaveLength(1)
  })

  it('гонка параллельных рёбер не создаёт цикл в БД (Serializable-транзакция)', async () => {
    const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'])
    setTestUser(ownerId)

    // Ребро-затравка A → B.
    await prisma.edge.create({ data: { treeId, sourceId: 'n1', targetId: 'n2' } })

    // Два параллельных запроса: B → C и C → A. Каждый по отдельности проходит
    // валидацию (видит только затравку), но вместе образуют цикл A → B → C → A.
    // Serializable-транзакция гарантирует: один из запросов будет отклонён.
    const [resBtoC, resCtoA] = await Promise.all([
      callRoute(createEdge, `/api/trees/${treeId}/edges`, 'POST', { id: treeId }, { sourceId: 'n2', targetId: 'n3' }),
      callRoute(createEdge, `/api/trees/${treeId}/edges`, 'POST', { id: treeId }, { sourceId: 'n3', targetId: 'n1' }),
    ])

    const statuses = [resBtoC.status, resCtoA.status]

    // Допустимые исходы: успех (201) либо корректное отклонение (400/409).
    // Внутренние ошибки (500) недопустимы для клиента — retry логика обязана
    // превращать serialization failures в управляемый ответ.
    for (const status of statuses) {
      expect([201, 400, 409]).toContain(status)
    }

    // Главный инвариант: итоговый граф ацикличен. Для каждого существующего
    // ребра s→t проверяем, что t НЕ достигает s (иначе ребро лежит на цикле).
    // (Прямой вызов hasCycle(edges, x, x) не годится: при совпадающих
    // аргументах он тривиально возвращает true.)
    const edges = await prisma.edge.findMany({
      where: { treeId },
      select: { sourceId: true, targetId: true, treeId: true },
    })
    for (const edge of edges) {
      expect(hasCycle(edges, edge.sourceId, edge.targetId)).toBe(false)
    }

    // И рёбер не больше трёх (затравка + максимум оба параллельных).
    expect(edges.length).toBeLessThanOrEqual(3)
  })
})

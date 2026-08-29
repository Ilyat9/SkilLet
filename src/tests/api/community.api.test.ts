import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/shared/lib/prisma'
import { POST as toggleLike } from '@/app/api/trees/[id]/like/route'
import { POST as forkTree } from '@/app/api/trees/[id]/fork/route'
import { GET as listForks } from '@/app/api/trees/[id]/forks/route'
import { GET as listComments, POST as createComment } from '@/app/api/trees/[id]/comments/route'
import { DELETE as deleteComment } from '@/app/api/trees/[id]/comments/[commentId]/route'
import { GET as listTrees } from '@/app/api/trees/route'
import {
  callRoute,
  createTestUser,
  resetDb,
  seedTreeWithNodes,
  setTestUser,
} from '../helpers/apiTest'

// Сессия мокается на уровне модуля (см. trees.api.test.ts).
vi.mock('@/shared/lib/auth', () => ({
  auth: async () => ({
    user: { id: (globalThis as unknown as Record<string, string | undefined>).__skilletTestUserId ?? '' },
  }),
}))

describe('Community API (likes / forks / comments / categories)', () => {
  const ownerId = 'user-owner'
  const strangerId = 'user-stranger'

  beforeEach(async () => {
    await resetDb()
    await createTestUser(ownerId)
    await createTestUser(strangerId)
  })

  describe('POST /api/trees/[id]/like', () => {
    it('ставит и снимает лайк (идемпотентный тоггл)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      setTestUser(strangerId)

      const put = await callRoute(toggleLike, `/api/trees/${treeId}/like`, 'POST', { id: treeId })
      expect(put.status).toBe(200)
      expect(put.json.data).toEqual({ liked: true, likes: 1 })

      const remove = await callRoute(toggleLike, `/api/trees/${treeId}/like`, 'POST', { id: treeId })
      expect(remove.status).toBe(200)
      expect(remove.json.data).toEqual({ liked: false, likes: 0 })

      expect(await prisma.treeLike.count()).toBe(0)
    })

    it('нельзя лайкать чужое приватное дерево (404)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], false)
      setTestUser(strangerId)

      const res = await callRoute(toggleLike, `/api/trees/${treeId}/like`, 'POST', { id: treeId })
      expect(res.status).toBe(404)
    })

    it('требует авторизацию (401)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      setTestUser('')
      const res = await callRoute(toggleLike, `/api/trees/${treeId}/like`, 'POST', { id: treeId })
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/trees/[id]/fork', () => {
    it('копирует публичное дерево со всеми узлами и связями + ссылку на оригинал', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      await prisma.edge.create({ data: { treeId, sourceId: 'n1', targetId: 'n2' } })
      await prisma.edge.create({ data: { treeId, sourceId: 'n2', targetId: 'n3' } })
      setTestUser(strangerId)

      const res = await callRoute(forkTree, `/api/trees/${treeId}/fork`, 'POST', { id: treeId })
      expect(res.status).toBe(201)

      const forkId = (res.json.data as { id: string }).id
      const fork = await prisma.tree.findUnique({
        where: { id: forkId },
        include: { nodes: true, edges: true },
      })
      expect(fork).not.toBeNull()
      expect(fork?.forkedFromId).toBe(treeId)
      expect(fork?.authorId).toBe(strangerId)
      expect(fork?.nodes).toHaveLength(3)
      expect(fork?.edges).toHaveLength(2)
      // Копия приватна по умолчанию.
      expect(fork?.isPublic).toBe(false)

      // Оригинал не изменён.
      const source = await prisma.tree.findUnique({ where: { id: treeId } })
      expect(source?.forkedFromId).toBeNull()
    })

    it('чужое приватное дерево неотличимо от несуществующего (404)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], false)
      setTestUser(strangerId)

      const res = await callRoute(forkTree, `/api/trees/${treeId}/fork`, 'POST', { id: treeId })
      expect(res.status).toBe(404)
      expect(res.json.error?.code).toBe('NOT_FOUND')

      // В БД форка не появилось.
      expect(await prisma.tree.count({ where: { forkedFromId: treeId } })).toBe(0)
    })

    it('требует авторизацию (401)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      setTestUser('')
      const res = await callRoute(forkTree, `/api/trees/${treeId}/fork`, 'POST', { id: treeId })
      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/trees/[id]/forks', () => {
    it('возвращает только публичные форки с пагинацией', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      setTestUser(strangerId)

      const forkPublic = await callRoute(forkTree, `/api/trees/${treeId}/fork`, 'POST', { id: treeId }, { isPublic: true })
      await callRoute(forkTree, `/api/trees/${treeId}/fork`, 'POST', { id: treeId })

      const res = await callRoute(listForks, `/api/trees/${treeId}/forks`, 'GET', { id: treeId })
      expect(res.status).toBe(200)
      const data = res.json.data as { items: Array<{ id: string }>; total: number }
      expect(data.total).toBe(1)
      expect(data.items[0]?.id).toBe((forkPublic.json.data as { id: string }).id)
    })
  })

  describe('comments', () => {
    it('создаёт комментарий, автор дерева может удалить любой, чужой — только свой', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)

      // Чужой пользователь оставляет комментарий.
      setTestUser(strangerId)
      const created = await callRoute(
        createComment,
        `/api/trees/${treeId}/comments`,
        'POST',
        { id: treeId },
        { body: 'Отличное дерево!' }
      )
      expect(created.status).toBe(201)
      const commentId = (created.json.data as { id: string }).id

      // Пустой комментарий отклоняется.
      const empty = await callRoute(
        createComment,
        `/api/trees/${treeId}/comments`,
        'POST',
        { id: treeId },
        { body: '   ' }
      )
      expect(empty.status).toBe(400)

      // Владелец дерева удаляет чужой комментарий (модерация).
      setTestUser(ownerId)
      const moderated = await callRoute(
        deleteComment,
        `/api/trees/${treeId}/comments/${commentId}`,
        'DELETE',
        { id: treeId, commentId }
      )
      expect(moderated.status).toBe(200)
      expect(await prisma.comment.count()).toBe(0)

      // Второй комментарий: автор удаляет свой, но чужой — не может.
      setTestUser(strangerId)
      const second = await callRoute(
        createComment,
        `/api/trees/${treeId}/comments`,
        'POST',
        { id: treeId },
        { body: 'Ещё раз!' }
      )
      const secondId = (second.json.data as { id: string }).id

      setTestUser(ownerId)
      const ownerCreate = await callRoute(
        createComment,
        `/api/trees/${treeId}/comments`,
        'POST',
        { id: treeId },
        { body: 'Спасибо!' }
      )
      const ownerCommentId = (ownerCreate.json.data as { id: string }).id

      // Чужой пользователь не может удалить комментарий владельца дерева.
      setTestUser(strangerId)
      const foreign = await callRoute(
        deleteComment,
        `/api/trees/${treeId}/comments/${ownerCommentId}`,
        'DELETE',
        { id: treeId, commentId: ownerCommentId }
      )
      expect(foreign.status).toBe(404)

      // Свой комментарий автор удаляет.
      const own = await callRoute(
        deleteComment,
        `/api/trees/${treeId}/comments/${secondId}`,
        'DELETE',
        { id: treeId, commentId: secondId }
      )
      expect(own.status).toBe(200)
    })

    it('GET пагинирован и возвращает авторов комментариев', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      setTestUser(strangerId)
      for (let i = 1; i <= 3; i += 1) {
        await callRoute(createComment, `/api/trees/${treeId}/comments`, 'POST', { id: treeId }, { body: `#${i}` })
      }

      const res = await callRoute(listComments, `/api/trees/${treeId}/comments?page=1&limit=2`, 'GET', { id: treeId })
      expect(res.status).toBe(200)
      const data = res.json.data as {
        items: Array<{ body: string; author: { id: string } }>
        total: number
        totalPages: number
        treeAuthorId: string
      }
      expect(data.total).toBe(3)
      expect(data.totalPages).toBe(2)
      expect(data.items).toHaveLength(2)
      // Newest-first.
      expect(data.items[0]?.body).toBe('#3')
      expect(data.items[0]?.author.id).toBe(strangerId)
      expect(data.treeAuthorId).toBe(ownerId)
    })

    it('комментарии чужого приватного дерева недоступны (404)', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], false)
      setTestUser(strangerId)
      const res = await callRoute(listComments, `/api/trees/${treeId}/comments`, 'GET', { id: treeId })
      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/trees — фильтры каталога', () => {
    it('фильтрует по категории и показывает счётчик лайков / likedByMe / сложность', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      await prisma.tree.update({ where: { id: treeId }, data: { category: 'FRONTEND' } })
      // Узлы с разной сложностью → средняя считается.
      await prisma.node.update({ where: { id: 'n1' }, data: { difficulty: 2 } })
      await prisma.node.update({ where: { id: 'n2' }, data: { difficulty: 4 } })
      await prisma.node.update({ where: { id: 'n3' }, data: { difficulty: 6 } })
      // Другое дерево другой категории.
      await prisma.tree.create({ data: { title: 'Soft', category: 'SOFT_SKILLS', authorId: ownerId } })

      setTestUser(strangerId)
      const liked = await callRoute(toggleLike, `/api/trees/${treeId}/like`, 'POST', { id: treeId })
      expect(liked.status).toBe(200)

      const byCategory = await callRoute(listTrees, '/api/trees?scope=public&category=FRONTEND', 'GET')
      const data = byCategory.json.data as { items: Array<Record<string, unknown>> }
      expect(data.items).toHaveLength(1)
      const item = data.items[0] as {
        id: string
        likedByMe: boolean
        difficultyStats: { avg: number; min: number; max: number }
        _count: { likes: number }
      }
      expect(item.id).toBe(treeId)
      expect(item.likedByMe).toBe(true)
      expect(item._count.likes).toBe(1)
      expect(item.difficultyStats).toEqual({ avg: 4, min: 2, max: 6 })
    })

    it('фильтрует по диапазону средней сложности', async () => {
      const { treeId } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      await prisma.node.update({ where: { id: 'n1' }, data: { difficulty: 8 } })
      await prisma.node.update({ where: { id: 'n2' }, data: { difficulty: 9 } })
      await prisma.node.update({ where: { id: 'n3' }, data: { difficulty: 10 } })

      const res = await callRoute(listTrees, '/api/trees?scope=public&minDifficulty=9&maxDifficulty=10', 'GET')
      const data = res.json.data as { items: Array<{ id: string }> }
      expect(data.items.map((t) => t.id)).toContain(treeId)

      const empty = await callRoute(listTrees, '/api/trees?scope=public&maxDifficulty=2', 'GET')
      const emptyData = empty.json.data as { items: Array<{ id: string }> }
      expect(emptyData.items.map((t) => t.id)).not.toContain(treeId)
    })

    it('сортирует по популярности (число лайков)', async () => {
      const { treeId: likedTree } = await seedTreeWithNodes(ownerId, ['n1', 'n2', 'n3'], true)
      const otherTree = await prisma.tree.create({ data: { title: 'Other', authorId: ownerId } })
      await prisma.node.create({ data: { id: 'o1', title: 'O1', resources: [], treeId: otherTree.id } })

      setTestUser(strangerId)
      await callRoute(toggleLike, `/api/trees/${likedTree}/like`, 'POST', { id: likedTree })

      const res = await callRoute(listTrees, '/api/trees?scope=public&sort=popular', 'GET')
      const data = res.json.data as { items: Array<{ id: string }> }
      expect(data.items[0]?.id).toBe(likedTree)
    })
  })
})
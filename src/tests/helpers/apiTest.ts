/**
 * Общие хелперы интеграционных тестов API.
 * Роут-хендлеры вызываются напрямую (как это делает Next.js): конструируем
 * NextRequest и передаём контекст с params. Сессия имитируется через
 * vi.mock('@/shared/lib/auth') — актуальный пользователь задаётся setTestUser.
 */
import { NextRequest } from 'next/server'
import { prisma } from '@/shared/lib/prisma'

/** Ключ globalThis, через который мок auth() получает актуального пользователя. */
const TEST_USER_KEY = '__skilletTestUserId'

/**
 * Задаёт «текущего пользователя» для мока auth().
 * globalThis — потому что vi.mock-фабрика исполняется вне области видимости модуля.
 */
export function setTestUser(userId: string): void {
  ;(globalThis as unknown as Record<string, string>)[TEST_USER_KEY] = userId
}

export function getTestUser(): string {
  return (globalThis as unknown as Record<string, string | undefined>)[TEST_USER_KEY] ?? ''
}

/** Полная очистка тестовой БД между кейсами (миграции не трогаем). */
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "User", "Tree", "Node", "Edge", "UserProgress", "Account", "Session",
     "VerificationToken", "Achievement", "UserAchievement" CASCADE`
  )
}

export async function createTestUser(id: string): Promise<void> {
  await prisma.user.create({ data: { id } })
}

export function jsonRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
): NextRequest {
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }
      : {}),
  })
}

/**
 * Контекст роута с «широкими» params: Promise<never> контрвариантно совместим
 * с конкретными типами роутов ({ params: Promise<{ id: string }> }), поэтому
 * любой route handler можно передать без кастов на местах вызова.
 */
type AnyRouteHandler = (req: NextRequest, ctx: { params: Promise<never> }) => Promise<Response>

export type RouteResult = {
  status: number
  json: { data?: unknown; error?: { message: string; code: string } }
}

export async function callRoute(
  handler: AnyRouteHandler,
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  params: Record<string, string> = {},
  body?: unknown
): Promise<RouteResult> {
  const request = jsonRequest(url, method, body)
  const response = await handler(request, {
    params: Promise.resolve(params) as unknown as Promise<never>,
  })
  return { status: response.status, json: await response.json() }
}

/** Создаёт дерево с узлами и одним ребром (для тестов графа). */
export async function seedTreeWithNodes(
  authorId: string,
  nodeIds: [string, string, string],
  isPublic = true
): Promise<{ treeId: string }> {
  const tree = await prisma.tree.create({
    data: { title: 'Test Tree', authorId, isPublic },
  })
  await prisma.node.createMany({
    data: nodeIds.map((id, index) => ({
      id,
      title: `Node ${index + 1}`,
      resources: [],
      positionX: index * 150,
      positionY: 0,
      treeId: tree.id,
    })),
  })
  return { treeId: tree.id }
}

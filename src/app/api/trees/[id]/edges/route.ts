import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { validateEdge } from '@/shared/lib/dag'
import { z } from 'zod'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const EdgeCreateSchema = z.object({
  sourceId: z.string().min(1, 'sourceId обязателен'),
  targetId: z.string().min(1, 'targetId обязателен'),
})

/** Сколько раз повторяем транзакцию при serialization failure (гонка параллельных рёбер). */
const MAX_TRANSACTION_RETRIES = 3

type CreateEdgeResult =
  | { ok: true; edge: { id: string; treeId: string; sourceId: string; targetId: string } }
  | { ok: false; code: 'CYCLE_OR_DUPLICATE' | 'CONFLICT' }

/**
 * Валидация DAG + создание ребра в ОДНОЙ Serializable-транзакции.
 *
 * Зачем: validateEdge читает существующие рёбра ДО вставки — при двух
 * параллельных запросах оба могут пройти валидацию независимо и вместе
 * создать цикл (TOCTOU). Serializable-изоляция заставляет Postgres прервать
 * одну из конкурирующих транзакций (P2034), поэтому инвариант DAG не нарушается
 * на уровне БД, а не «на удачу» между чтением и записью.
 * Дубликат ребра дополнительно защищён @@unique([sourceId, targetId]) (P2002).
 */
async function createEdgeTransactionally(
  treeId: string,
  sourceId: string,
  targetId: string
): Promise<CreateEdgeResult> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existingEdges = await tx.edge.findMany({
            where: { treeId },
            select: { sourceId: true, targetId: true, treeId: true },
          })

          // validateEdge проверяет: самопетлю, дубликат ребра и цикл в DAG.
          const edgeValidation = validateEdge(existingEdges, treeId, sourceId, targetId)
          if (!edgeValidation.valid) {
            return { ok: false as const, code: 'CYCLE_OR_DUPLICATE' as const }
          }

          const edge = await tx.edge.create({
            data: { treeId, sourceId, targetId },
          })
          return { ok: true as const, edge }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      // P2034 — serialization failure / write conflict при параллельной транзакции:
      // повторяем попытку (валидация перечитает рёбра уже с учётом конкурента).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        if (attempt === MAX_TRANSACTION_RETRIES) {
          return { ok: false, code: 'CONFLICT' }
        }
        continue
      }
      // P2002 — уникальный constraint (sourceId, targetId): дубликат ребра.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false, code: 'CYCLE_OR_DUPLICATE' }
      }
      throw error
    }
  }
  return { ok: false, code: 'CONFLICT' }
}

// POST /api/trees/[id]/edges — создание ребра между узлами одного дерева
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const { id: treeId } = await params

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
    })

    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    if (tree.authorId !== session.user.id) {
      return NextResponse.json(
        createErrorResponse('Forbidden', 'FORBIDDEN'),
        { status: 403 }
      )
    }

    // Rate limit на создание связей.
    const rateLimit = checkRateLimit(`edge-create:${session.user.id}:${treeId}`, RATE_LIMITS.edgeCreate)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = EdgeCreateSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { sourceId, targetId } = validation.data

    // Оба узла должны существовать и принадлежать этому дереву.
    const [source, target] = await Promise.all([
      prisma.node.findUnique({ where: { id: sourceId }, select: { id: true, treeId: true } }),
      prisma.node.findUnique({ where: { id: targetId }, select: { id: true, treeId: true } }),
    ])

    if (!source || source.treeId !== treeId) {
      return NextResponse.json(
        createErrorResponse('Source node not found in this tree', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    if (!target || target.treeId !== treeId) {
      return NextResponse.json(
        createErrorResponse('Target node not found in this tree', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    // Валидация DAG + вставка — атомарно (см. комментарий к createEdgeTransactionally):
    // параллельные запросы не могут вместе создать цикл.
    const result = await createEdgeTransactionally(treeId, sourceId, targetId)

    if (!result.ok) {
      return NextResponse.json(
        createErrorResponse(
          result.code === 'CONFLICT'
            ? 'Конфликт параллельного изменения дерева, попробуйте ещё раз'
            : 'Связь не может быть создана: дубликат или цикл в графе',
          result.code === 'CONFLICT' ? 'CONFLICT' : 'VALIDATION_ERROR'
        ),
        { status: result.code === 'CONFLICT' ? 409 : 400 }
      )
    }

    return NextResponse.json(createSuccessResponse(result.edge), { status: 201 })
  } catch (error) {
    logApiError('POST /api/trees/[id]/edges', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'
import { sanitizeIndexConnections } from '@/shared/lib/dag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ForkRequestSchema = z.object({
  isPublic: z.boolean().optional(),
})

/**
 * POST /api/trees/[id]/fork — создание копии дерева в аккаунте текущего
 * пользователя. Копируются Tree + все Node + все Edge одной транзакцией,
 * forkedFromId ссылается на оригинал (атрибуция автора сохраняется).
 *
 * Правила:
 * - форкнуть можно только ПУБЛИЧНОЕ дерево (чужое приватное неотличимо
 *   от несуществующего → 404, не раскрываем наличие приватных деревьев);
 * - владелец может форкнуть и своё дерево (получит независимую копию);
 * - форк создаётся приватным по умолчанию (isPublic можно передать явно).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }
    const userId = session.user.id

    // Rate limit: форк копирует целое дерево — лимит как у шаблонов.
    const rateLimit = checkRateLimit(`tree-fork:${userId}`, RATE_LIMITS.treeTemplate)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const { id: treeId } = await params

    // Тело необязательно (isPublic по умолчанию false), но парсим с валидацией
    // для единообразия с остальными мутациями.
    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error
    const validation = ForkRequestSchema.safeParse(parsedBody.body ?? {})
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }
    const isPublic = validation.data.isPublic ?? false

    // Загружаем оригинал со всем содержимым. Только публичные деревья форкабельны.
    const source = await prisma.tree.findFirst({
      where: { id: treeId, isPublic: true },
      include: { nodes: true, edges: true },
    })
    if (!source) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    // Паттерн seed.ts: вложенный create узлов → маппинг индексов → createMany рёбер.
    // Рёбра оригинала уже валидны (DAG-инвариант создающих мутаций), но
    // пересобираем их по парам индексов узлов копии, а не копируем id.
    const nodeIndexByOldId = new Map(source.nodes.map((node, index) => [node.id, index]))

    const forked = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title: source.title,
          description: source.description,
          category: source.category,
          isPublic,
          authorId: userId,
          forkedFromId: source.id,
          nodes: {
            create: source.nodes.map((node) => ({
              title: node.title,
              description: node.description,
              positionX: node.positionX,
              positionY: node.positionY,
              difficulty: node.difficulty,
              // resources — Json на источнике; null невозможен по схеме, но тип
              // JsonValue шире InputJsonValue — приводим явно (Prisma).
              resources: node.resources as Prisma.InputJsonValue,
            })),
          },
        },
        include: { nodes: true },
      })

      // Порядок узлов копии совпадает с порядком source.nodes (вложенный create
      // сохраняет порядок массива) — индексы сопоставимы.
      const edgeIndexPairs = source.edges.flatMap((edge) => {
        const sourceIndex = nodeIndexByOldId.get(edge.sourceId)
        const targetIndex = nodeIndexByOldId.get(edge.targetId)
        return sourceIndex !== undefined && targetIndex !== undefined
          ? [[sourceIndex, targetIndex] as const]
          : []
      })

      const edgesData = sanitizeIndexConnections(source.nodes.length, edgeIndexPairs)
        .map(({ sourceIndex, targetIndex }) => {
          const createdSource = tree.nodes[sourceIndex]
          const createdTarget = tree.nodes[targetIndex]
          return createdSource && createdTarget
            ? { treeId: tree.id, sourceId: createdSource.id, targetId: createdTarget.id }
            : null
        })
        .filter((edge): edge is { treeId: string; sourceId: string; targetId: string } => edge !== null)

      if (edgesData.length > 0) {
        await tx.edge.createMany({ data: edgesData })
      }

      return tree
    })

    logEvent('tree_forked', {
      userId,
      sourceTreeId: treeId,
      treeId: forked.id,
      nodesCount: source.nodes.length,
      edgesCount: source.edges.length,
      requestId,
    })

    return NextResponse.json(
      createSuccessResponse({ id: forked.id, nodesCount: source.nodes.length }),
      { status: 201 }
    )
  } catch (error) {
    logApiError('POST /api/trees/[id]/fork', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
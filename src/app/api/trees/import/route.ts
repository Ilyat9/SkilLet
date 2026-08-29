import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeExportSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'
import { sanitizeIndexConnections } from '@/shared/lib/dag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/trees/import — импорт дерева из JSON-файла формата SkilLet
 * (см. TreeExportSchema: portable-формат без внутренних id, связи по индексам
 * массива узлов). Дерево создаётся под текущим пользователем КАК НОВЫМ АВТОРОМ
 * одной транзакцией (Tree → вложенный create Node[] → createMany Edge[]).
 *
 * Защита от вредоносного/аномального JSON — те же лимиты, что у обычного API
 * создания: размер тела (parseJsonBody, 1 MiB), MAX_NODES_PER_TREE /
 * MAX_EDGES_PER_TREE в zod-схеме, ограничение длин строк, строгое поле
 * format: 'skillet-tree' (произвольный JSON не пройдёт валидацию).
 */
export async function POST(request: NextRequest) {
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

    // Rate limit: импорт тяжёл (много узлов одной транзакцией) — как шаблоны.
    const rateLimit = checkRateLimit(`tree-import:${userId}`, RATE_LIMITS.treeTemplate)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = TreeExportSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(
          validation.error.errors[0]?.message ?? 'Файл не соответствует формату SkilLet',
          'VALIDATION_ERROR'
        ),
        { status: 400 }
      )
    }

    const { title, description, category, nodes, connections } = validation.data

    // Связи фильтруются тем же инвариантом, что и шаблоны: валидные индексы,
    // без самопетель/дубликатов/циклов (портативный файл мог быть изменён руками).
    const acceptedEdges = sanitizeIndexConnections(nodes.length, connections)

    const tree = await prisma.$transaction(async (tx) => {
      const createdTree = await tx.tree.create({
        data: {
          title,
          ...(description !== undefined ? { description } : {}),
          category,
          // Импортированное дерево приватно по умолчанию: публикует автор.
          isPublic: false,
          authorId: userId,
          nodes: {
            create: nodes.map((node) => ({
              title: node.title,
              description: node.description ?? null,
              positionX: node.positionX,
              positionY: node.positionY,
              difficulty: node.difficulty,
              resources:
                node.resourceType && node.resourceUrl && node.resourceTitle
                  ? [{ type: node.resourceType, url: node.resourceUrl, title: node.resourceTitle }]
                  : [],
            })),
          },
        },
        include: { nodes: true },
      })

      // Маппинг локальный индекс массива → реальный id узла в БД (паттерн seed.ts).
      const edgesData = acceptedEdges
        .map(({ sourceIndex, targetIndex }) => {
          const sourceNode = createdTree.nodes[sourceIndex]
          const targetNode = createdTree.nodes[targetIndex]
          return sourceNode && targetNode
            ? { treeId: createdTree.id, sourceId: sourceNode.id, targetId: targetNode.id }
            : null
        })
        .filter((edge): edge is { treeId: string; sourceId: string; targetId: string } => edge !== null)

      if (edgesData.length > 0) {
        await tx.edge.createMany({ data: edgesData })
      }

      return createdTree
    })

    logEvent('tree_imported', {
      userId,
      treeId: tree.id,
      nodesCount: nodes.length,
      edgesCount: acceptedEdges.length,
      requestId,
    })

    return NextResponse.json(
      createSuccessResponse({
        id: tree.id,
        nodesCount: nodes.length,
        edgesCount: acceptedEdges.length,
      }),
      { status: 201 }
    )
  } catch (error) {
    logApiError('POST /api/trees/import', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
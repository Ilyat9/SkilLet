import { logApiError } from '@/shared/lib/logger'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, WRITE_RATE_LIMIT_MS } from '@/shared/lib/rateLimit'
import { hasCycle } from '@/shared/lib/dag'
import { MAX_NODES_PER_TREE } from '@/shared/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TemplateNodeSchema = z.object({
  title: z.string().min(1, 'Название узла обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000).optional(),
  positionX: z.number(),
  positionY: z.number(),
  difficulty: z.number().int().min(1).max(10),
  resourceType: z.enum(['video', 'article']).optional(),
  resourceUrl: z.string().url().optional(),
  resourceTitle: z.string().max(200).optional(),
})

const FromTemplateSchema = z.object({
  title: z.string().min(1, 'Название дерева обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
  nodes: z.array(TemplateNodeSchema).min(1, 'Шаблон должен содержать хотя бы один узел').max(MAX_NODES_PER_TREE),
  connections: z.array(z.tuple([z.number().int(), z.number().int()])),
})

/**
 * POST /api/trees/from-template — создание реального дерева из шаблона
 * одной транзакцией (Tree → вложенный create Node[] → createMany Edge[]),
 * паттерн идентичен prisma/seed.ts. Владельцем становится текущий пользователь.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    // Rate limit: создание из шаблона тяжелее обычного создания — лимит строже.
    const rateLimit = checkRateLimit(`tree-template:${session.user.id}`, WRITE_RATE_LIMIT_MS * 3)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = FromTemplateSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, isPublic, nodes, connections } = validation.data

    // Фильтруем связи шаблона тем же инвариантом, что и ручное создание рёбер:
    // валидные индексы, без самопетель/дубликатов/циклов.
    type AcceptedEdge = { sourceIndex: number; targetIndex: number }
    const acceptedEdges: AcceptedEdge[] = []

    for (const [sourceIndex, targetIndex] of connections) {
      if (sourceIndex === targetIndex) continue
      if (sourceIndex < 0 || sourceIndex >= nodes.length) continue
      if (targetIndex < 0 || targetIndex >= nodes.length) continue
      if (acceptedEdges.some((e) => e.sourceIndex === sourceIndex && e.targetIndex === targetIndex)) continue

      const currentAsDag = acceptedEdges.map((e) => ({
        sourceId: String(e.sourceIndex),
        targetId: String(e.targetIndex),
        treeId: 'template',
      }))
      if (hasCycle(currentAsDag, String(sourceIndex), String(targetIndex))) continue

      acceptedEdges.push({ sourceIndex, targetIndex })
    }

    const tree = await prisma.$transaction(async (tx) => {
      const createdTree = await tx.tree.create({
        data: {
          title,
          ...(description !== undefined ? { description } : {}),
          isPublic: isPublic ?? true,
          authorId: session.user.id,
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

      // Маппинг индекс массива шаблона → реальный id узла из БД.
      const idByIndex = new Map<number, string>()
      for (let index = 0; index < nodes.length; index += 1) {
        const createdNode = createdTree.nodes[index]
        if (createdNode) idByIndex.set(index, createdNode.id)
      }

      const edgesData = acceptedEdges
        .map(({ sourceIndex, targetIndex }) => ({
          treeId: createdTree.id,
          sourceId: idByIndex.get(sourceIndex),
          targetId: idByIndex.get(targetIndex),
        }))
        .filter((edge): edge is { treeId: string; sourceId: string; targetId: string } =>
          Boolean(edge.sourceId && edge.targetId)
        )

      if (edgesData.length > 0) {
        await tx.edge.createMany({ data: edgesData })
      }

      return createdTree
    })

    return NextResponse.json(
      createSuccessResponse({ id: tree.id, nodesCount: nodes.length, edgesCount: acceptedEdges.length }),
      { status: 201 }
    )
  } catch (error) {
    logApiError('POST /api/trees/from-template', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

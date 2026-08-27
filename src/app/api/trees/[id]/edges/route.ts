import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { validateEdge } from '@/shared/lib/dag'
import { z } from 'zod'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

const EdgeCreateSchema = z.object({
  sourceId: z.string().min(1, 'sourceId обязателен'),
  targetId: z.string().min(1, 'targetId обязателен'),
})

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
      prisma.node.findUnique({ where: { id: sourceId } }),
      prisma.node.findUnique({ where: { id: targetId } }),
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

    const existingEdges = await prisma.edge.findMany({
      where: { treeId },
      select: { sourceId: true, targetId: true, treeId: true },
    })

    // validateEdge проверяет: самопетлю, дубликат ребра и цикл в DAG.
    const edgeValidation = validateEdge(existingEdges, treeId, sourceId, targetId)
    if (!edgeValidation.valid) {
      return NextResponse.json(
        createErrorResponse(edgeValidation.error ?? 'Invalid edge', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const edge = await prisma.edge.create({
      data: {
        treeId,
        sourceId,
        targetId,
      },
    })

    return NextResponse.json(createSuccessResponse(edge), { status: 201 })
  } catch (error) {
    console.error('[POST /api/trees/[id]/edges]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
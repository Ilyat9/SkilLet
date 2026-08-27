import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { NodeCreateSchema } from '@/entities/node/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { MAX_NODES_PER_TREE } from '@/shared/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/trees/[id]/nodes — создание узла (только автор дерева)
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

    // Лимит количества узлов на дерево — защита от аномальных нагрузок.
    const nodeCount = await prisma.node.count({ where: { treeId } })
    if (nodeCount >= MAX_NODES_PER_TREE) {
      return NextResponse.json(
        createErrorResponse(`Достигнут лимит: не больше ${MAX_NODES_PER_TREE} узлов на дерево`, 'LIMIT_REACHED'),
        { status: 400 }
      )
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = NodeCreateSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, positionX, positionY, difficulty, resourceType, resourceUrl, resourceTitle } =
      validation.data

    const resources =
      resourceType && resourceUrl && resourceTitle
        ? [{ type: resourceType, url: resourceUrl, title: resourceTitle }]
        : []

    const node = await prisma.node.create({
      data: {
        title,
        description: description ?? null,
        positionX,
        positionY,
        difficulty,
        resources,
        treeId,
      },
    })

    return NextResponse.json(createSuccessResponse(node), { status: 201 })
  } catch (error) {
    console.error('[POST /api/trees/[id]/nodes]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
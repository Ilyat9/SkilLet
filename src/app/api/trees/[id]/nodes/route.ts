import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { NodeCreateSchema } from '@/entities/node/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

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

    const body = await request.json()
    const validation = NodeCreateSchema.safeParse(body)

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
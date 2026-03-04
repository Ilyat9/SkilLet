import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeUpdateSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const treeId = params.id
    const session = await auth()
    const userId = session?.user?.id

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        _count: { select: { nodes: true } },
        author: {
          select: { id: true, name: true, image: true },
        },
        nodes: {
          include: {
            outgoingEdges: true,
            incomingEdges: true,
          },
        },
        progresses: userId ? {
          where: { userId },
        } : undefined,
      },
    })

    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const isOwner = tree.authorId === userId
    const isPublic = tree.isPublic
    const isAccessible = isOwner || isPublic

    if (!isAccessible) {
      return NextResponse.json(
        createErrorResponse('Access denied', 'FORBIDDEN'),
        { status: 403 }
      )
    }

    const treeWithRelations = {
      ...tree,
      nodes: tree.nodes.map((node) => ({
        ...node,
        outgoingEdges: node.outgoingEdges,
        incomingEdges: node.incomingEdges,
      })),
    }

    return NextResponse.json(createSuccessResponse(treeWithRelations))
  } catch (error) {
    console.error('[GET /api/trees/[id]]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const treeId = params.id

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
    const validation = TreeUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0].message, 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, isPublic } = validation.data

    const result = await prisma.tree.update({
      where: { id: treeId },
      data: { title, description, isPublic },
    })

    return NextResponse.json(createSuccessResponse(result))
  } catch (error) {
    console.error('[PATCH /api/trees/[id]]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const treeId = params.id

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

    await prisma.tree.delete({
      where: { id: treeId },
    })

    return NextResponse.json(createSuccessResponse({ message: 'Tree deleted' }))
  } catch (error) {
    console.error('[DELETE /api/trees/[id]]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

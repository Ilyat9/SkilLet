import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const body = await request.json()
    const { treeId, nodeId, completed } = body

    if (!treeId || !nodeId || typeof completed !== 'boolean') {
      return NextResponse.json(
        createErrorResponse('Missing required fields', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        nodes: true,
      },
    })

    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const node = tree.nodes.find(n => n.id === nodeId)
    if (!node) {
      return NextResponse.json(
        createErrorResponse('Node not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    if (tree.authorId !== session.user.id && !tree.isPublic) {
      return NextResponse.json(
        createErrorResponse('Access denied', 'FORBIDDEN'),
        { status: 403 }
      )
    }

    const existingProgress = await prisma.userProgress.findUnique({
      where: {
        userId_nodeId: {
          userId: session.user.id,
          nodeId,
        },
      },
    })

    let progress
    if (existingProgress) {
      progress = await prisma.userProgress.update({
        where: {
          userId_nodeId: {
            userId: session.user.id,
            nodeId,
          },
        },
        data: {
          completed,
          completedAt: completed ? new Date() : null,
        },
      })
    } else {
      progress = await prisma.userProgress.create({
        data: {
          userId: session.user.id,
          treeId,
          nodeId,
          completed,
          completedAt: completed ? new Date() : null,
        },
      })
    }

    return NextResponse.json(createSuccessResponse(progress))
  } catch (error) {
    console.error('[POST /api/trees/[id]/progress]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

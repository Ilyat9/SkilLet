import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string; edgeId: string }> }

// DELETE /api/trees/[id]/edges/[edgeId] — удаление ребра
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const { id: treeId, edgeId } = await params

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

    const existingEdge = await prisma.edge.findUnique({
      where: { id: edgeId },
    })

    if (!existingEdge || existingEdge.treeId !== treeId) {
      return NextResponse.json(
        createErrorResponse('Edge not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    await prisma.edge.delete({
      where: { id: edgeId },
    })

    return NextResponse.json(createSuccessResponse({ message: 'Edge deleted' }))
  } catch (error) {
    console.error('[DELETE /api/trees/[id]/edges/[edgeId]]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
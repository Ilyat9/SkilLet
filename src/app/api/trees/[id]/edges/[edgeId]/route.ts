import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

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

    // Rate limit на удаление связей.
    const rateLimit = checkRateLimit(`edge-delete:${session.user.id}`, RATE_LIMITS.edgeDelete)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
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

    // Scoped-delete: ребро должно принадлежать указанному дереву текущего владельца.
    try {
      await prisma.edge.delete({
        where: { id: edgeId, treeId, tree: { authorId: session.user.id } },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Edge not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(createSuccessResponse({ message: 'Edge deleted' }))
  } catch (error) {
    logApiError('DELETE /api/trees/[id]/edges/[edgeId]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
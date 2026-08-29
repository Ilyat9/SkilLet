import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/trees/[id]/comments/[commentId] — удаление комментария.
 * Право удаления: автор комментария ИЛИ владелец дерева (модерация).
 * Чужое приватное дерево/чужой комментарий на чужом дереве → 404
 * (не раскрываем существование).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
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

    const { id: treeId, commentId } = await params

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true, authorId: true },
    })
    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    // Модерация: владелец дерева может удалять любые комментарии своего дерева;
    // обычный пользователь — только свои. Один scoped-запрос: commentId + treeId
    // + (authorId = userId ИЛИ владелец дерева = userId).
    try {
      await prisma.comment.delete({
        where: {
          id: commentId,
          // Проверка прав внутри WHERE исключает TOCTOU между чтением и удалением.
          ...(tree.authorId === userId
            ? { treeId }
            : { treeId, authorId: userId }),
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Comment not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    logEvent('comment_deleted', {
      userId,
      treeId,
      commentId,
      moderated: tree.authorId !== userId,
      requestId,
    })

    return NextResponse.json(createSuccessResponse({ message: 'Comment deleted' }))
  } catch (error) {
    logApiError('DELETE /api/trees/[id]/comments/[commentId]', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
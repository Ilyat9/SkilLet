import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Дефолт и максимум страницы комментариев (список не ограничен). */
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 50

const CommentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Комментарий не может быть пустым')
    .max(2000, 'Слишком длинный комментарий (максимум 2000 символов)'),
})

/**
 * GET /api/trees/[id]/comments — комментарии дерева, newest-first, пагинация.
 * Доступны на публичных деревьях и для владельца приватного.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { id: treeId } = await params

    const session = await auth()
    const userId = session?.user?.id

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true, authorId: true, isPublic: true },
    })
    if (!tree || (!tree.isPublic && tree.authorId !== userId)) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const limitRaw = Number(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, limitRaw))

    const [comments, total] = await prisma.$transaction([
      prisma.comment.findMany({
        where: { treeId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      }),
      prisma.comment.count({ where: { treeId } }),
    ])

    // Право удаления подсчитывается на клиенте: comment.authorId === userId
    // или дерево принадлежит пользователю (authorId уже в ответе комментария).
    const response = NextResponse.json(
      createSuccessResponse({
        items: comments,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        /** Идентификатор владельца дерева — для рендера кнопок модерации. */
        treeAuthorId: tree.authorId,
      })
    )
    response.headers.set('X-Request-Id', requestId)
    return response
  } catch (error) {
    logApiError('GET /api/trees/[id]/comments', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/trees/[id]/comments — добавить комментарий (только авторизованные).
 * Комментарии разрешены на публичных деревьях и на своих приватных.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Rate limit: защита от спама комментариями.
    const rateLimit = checkRateLimit(`comment:${userId}`, RATE_LIMITS.comment)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const { id: treeId } = await params

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true, authorId: true, isPublic: true },
    })
    if (!tree || (!tree.isPublic && tree.authorId !== userId)) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = CommentCreateSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const comment = await prisma.comment.create({
      data: { body: validation.data.body, authorId: userId, treeId },
      include: { author: { select: { id: true, name: true, image: true } } },
    })

    logEvent('comment_created', { userId, treeId, commentId: comment.id, requestId })

    return NextResponse.json(createSuccessResponse(comment), { status: 201 })
  } catch (error) {
    logApiError('POST /api/trees/[id]/comments', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
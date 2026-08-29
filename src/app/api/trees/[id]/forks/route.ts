import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Дефолт и максимум страницы для истории форков (список не ограничен). */
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50

/**
 * GET /api/trees/[id]/forks — публичные форки дерева (история форков).
 * Пагинированный список: форки создаются неограниченно, отдаём страницы
 * newest-first с метаданными автора копии.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = getRequestId(request)
  try {
    const { id: treeId } = await params

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true },
    })
    if (!tree) {
      return NextResponse.json(
        createErrorResponse('Tree not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const limitRaw = Number(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, limitRaw))

    const [forks, total] = await prisma.$transaction([
      prisma.tree.findMany({
        // Показываем только публичные форки (приватные чужие копии не раскрываем;
        // свои приватные форки пользователь видит в «моих деревьях»).
        where: { forkedFromId: treeId, isPublic: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          createdAt: true,
          author: { select: { id: true, name: true, image: true } },
        },
      }),
      prisma.tree.count({ where: { forkedFromId: treeId, isPublic: true } }),
    ])

    const response = NextResponse.json(
      createSuccessResponse({
        items: forks,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    )
    response.headers.set('X-Request-Id', requestId)
    return response
  } catch (error) {
    logApiError('GET /api/trees/[id]/forks', error, { requestId })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
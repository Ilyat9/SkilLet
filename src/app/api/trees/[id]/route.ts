import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeUpdateSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: treeId } = await params
    const session = await auth()
    const userId = session?.user?.id

    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      include: {
        _count: { select: { nodes: true, edges: true, likes: true, comments: true } },
        author: {
          select: { id: true, name: true, image: true },
        },
        // Атрибуция форка: «форк дерева «X» от @автор».
        forkedFrom: {
          select: { id: true, title: true, author: { select: { id: true, name: true } } },
        },
        nodes: true,
        // Рёбра запрашиваются ОДИН раз на уровне дерева: каждое ребро ранее
        // дублировалось в ответе дважды (как outgoingEdges источника и как
        // incomingEdges цели). Клиент строит и граф ReactFlow, и статусы узлов
        // (getNodeStatus) из этого единого массива edges.
        edges: true,
        progresses: userId ? { where: { userId } } : false,
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

    // likedByMe персонален — посчитать дёшево (одна строка по уникальному индексу).
    const likedByMe = userId
      ? Boolean(
          await prisma.treeLike.findUnique({
            where: { userId_treeId: { userId, treeId } },
            select: { id: true },
          })
        )
      : false

    // Персонализированный ответ (прогресс текущего пользователя) — не кэшируется.
    return NextResponse.json(createSuccessResponse({ ...tree, likedByMe }), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    logApiError('GET /api/trees/[id]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const { id: treeId } = await params

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = TreeUpdateSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    // Проверка владельца и мутация одним scoped-запросом (authorId в WHERE):
    // исключает TOCTOU между чтением и записью; P2025 (не найдено с учётом
    // фильтра) маппится в тот же ответ, что и «чужое дерево» — 404.
    const { title, description, category, isPublic } = validation.data

    let result
    try {
      result = await prisma.tree.update({
        where: { id: treeId, authorId: session.user.id },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
          ...(isPublic !== undefined ? { isPublic } : {}),
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Tree not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(createSuccessResponse(result))
  } catch (error) {
    logApiError('PATCH /api/trees/[id]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const { id: treeId } = await params

    // Scoped-delete: authorId в WHERE исключает TOCTOU; несуществующее ИЛИ
    // чужое дерево неотличимо дают 404 (не раскрываем существование приватных деревьев).
    try {
      await prisma.tree.delete({
        where: { id: treeId, authorId: session.user.id },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Tree not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(createSuccessResponse({ message: 'Tree deleted' }))
  } catch (error) {
    logApiError('DELETE /api/trees/[id]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

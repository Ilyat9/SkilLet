import { logApiError } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { NodeUpdateSchema } from '@/entities/node/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string; nodeId: string }> }

/**
 * Проверка владельца дерева при чтении (для ответов 404/403 до мутации).
 * Сами мутации ниже дополнительно scoped по authorId в WHERE — см. PATCH/DELETE.
 */
async function requireTreeOwner(treeId: string, userId: string) {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { authorId: true },
  })

  if (!tree) {
    return { error: 'NOT_FOUND' as const }
  }

  if (tree.authorId !== userId) {
    return { error: 'FORBIDDEN' as const }
  }

  return { tree }
}

// PATCH /api/trees/[id]/nodes/[nodeId] — обновление узла (только автор дерева)
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    // Rate limit на обновление узлов (drag & drop координат — частый запрос).
    const rateLimit = checkRateLimit(`node-update:${session.user.id}`, RATE_LIMITS.nodeUpdate)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const { id: treeId, nodeId } = await params

    const guard = await requireTreeOwner(treeId, session.user.id)
    if ('error' in guard) {
      const status = guard.error === 'NOT_FOUND' ? 404 : 403
      return NextResponse.json(
        createErrorResponse(
          guard.error === 'NOT_FOUND' ? 'Tree not found' : 'Forbidden',
          guard.error
        ),
        { status }
      )
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = NodeUpdateSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, positionX, positionY, difficulty, resourceType, resourceUrl, resourceTitle,
      clearResource } =
      validation.data

    // Ресурс хранится массивом с максимум одним элементом.
    let resources: Array<{ type: 'video' | 'article'; url: string; title: string }> | undefined
    if (clearResource === true) {
      // Явное удаление ресурса с узла.
      resources = []
    } else if (resourceType !== undefined || resourceUrl !== undefined || resourceTitle !== undefined) {
      // Если передан хотя бы один ресурсный филд — пересобираем массив resources целиком:
      // полный комплект полей даёт ресурс, частичный — убирает его.
      resources =
        resourceType && resourceUrl && resourceTitle
          ? [{ type: resourceType, url: resourceUrl, title: resourceTitle }]
          : []
    }

    // Scoped-update: узел должен существовать, принадлежать этому дереву
    // и дереву текущего владельца — всё в одном WHERE (исключает TOCTOU).
    let node
    try {
      node = await prisma.node.update({
        where: { id: nodeId, treeId, tree: { authorId: session.user.id } },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(positionX !== undefined ? { positionX } : {}),
          ...(positionY !== undefined ? { positionY } : {}),
          ...(difficulty !== undefined ? { difficulty } : {}),
          ...(resources !== undefined ? { resources } : {}),
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Node not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(createSuccessResponse(node))
  } catch (error) {
    logApiError('PATCH /api/trees/[id]/nodes/[nodeId]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

// DELETE /api/trees/[id]/nodes/[nodeId] — удаление узла.
// Связанные Edge и UserProgress удалятся каскадно (onDelete: Cascade).
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    // Rate limit на удаление узлов.
    const rateLimit = checkRateLimit(`node-delete:${session.user.id}`, RATE_LIMITS.nodeDelete)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
    }

    const { id: treeId, nodeId } = await params

    const guard = await requireTreeOwner(treeId, session.user.id)
    if ('error' in guard) {
      const status = guard.error === 'NOT_FOUND' ? 404 : 403
      return NextResponse.json(
        createErrorResponse(
          guard.error === 'NOT_FOUND' ? 'Tree not found' : 'Forbidden',
          guard.error
        ),
        { status }
      )
    }

    // Scoped-delete (id + treeId + владелец дерева в одном WHERE).
    try {
      await prisma.node.delete({
        where: { id: nodeId, treeId, tree: { authorId: session.user.id } },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return NextResponse.json(
          createErrorResponse('Node not found', 'NOT_FOUND'),
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json(createSuccessResponse({ message: 'Node deleted' }))
  } catch (error) {
    logApiError('DELETE /api/trees/[id]/nodes/[nodeId]', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
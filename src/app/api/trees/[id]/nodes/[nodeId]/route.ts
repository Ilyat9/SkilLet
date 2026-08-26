import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { NodeUpdateSchema } from '@/entities/node/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string; nodeId: string }> }

async function requireTreeOwner(treeId: string, userId: string) {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
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

    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
    })

    if (!existingNode || existingNode.treeId !== treeId) {
      return NextResponse.json(
        createErrorResponse('Node not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    const body = await request.json()
    const validation = NodeUpdateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, positionX, positionY, difficulty, resourceType, resourceUrl, resourceTitle } =
      validation.data

    // Если передан хотя бы один ресурсный филд — пересобираем массив resources целиком.
    let resources: Array<{ type: 'video' | 'article'; url: string; title: string }> | undefined
    if (resourceType !== undefined || resourceUrl !== undefined || resourceTitle !== undefined) {
      resources =
        resourceType && resourceUrl && resourceTitle
          ? [{ type: resourceType, url: resourceUrl, title: resourceTitle }]
          : []
    }

    const node = await prisma.node.update({
      where: { id: nodeId },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(positionX !== undefined ? { positionX } : {}),
        ...(positionY !== undefined ? { positionY } : {}),
        ...(difficulty !== undefined ? { difficulty } : {}),
        ...(resources !== undefined ? { resources } : {}),
      },
    })

    return NextResponse.json(createSuccessResponse(node))
  } catch (error) {
    console.error('[PATCH /api/trees/[id]/nodes/[nodeId]]', error)
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

    const existingNode = await prisma.node.findUnique({
      where: { id: nodeId },
    })

    if (!existingNode || existingNode.treeId !== treeId) {
      return NextResponse.json(
        createErrorResponse('Node not found', 'NOT_FOUND'),
        { status: 404 }
      )
    }

    await prisma.node.delete({
      where: { id: nodeId },
    })

    return NextResponse.json(createSuccessResponse({ message: 'Node deleted' }))
  } catch (error) {
    console.error('[DELETE /api/trees/[id]/nodes/[nodeId]]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}
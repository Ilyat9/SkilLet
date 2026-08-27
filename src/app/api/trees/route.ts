import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeCreateSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')

    // Листинг возможен ТОЛЬКО в явном режиме: публичные деревья или «мои деревья».
    if (scope !== 'public' && scope !== 'mine') {
      return NextResponse.json(
        createErrorResponse(
          "Query parameter 'scope' is required and must be 'public' or 'mine'",
          'VALIDATION_ERROR'
        ),
        { status: 400 }
      )
    }

    let where: { isPublic?: boolean; authorId?: string }

    if (scope === 'mine') {
      const session = await auth()
      if (!session?.user?.id) {
        return NextResponse.json(
          createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
          { status: 401 }
        )
      }
      where = { authorId: session.user.id }
    } else {
      where = { isPublic: true }
    }

    const trees = await prisma.tree.findMany({
      where,
      include: {
        _count: {
          select: {
            nodes: true,
            // Популярность дерева по ТЗ: количество UserProgress с completed=true.
            progresses: { where: { completed: true } },
            edges: true,
          },
        },
        author: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(createSuccessResponse(trees))
  } catch (error) {
    console.error('[GET /api/trees]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = TreeCreateSchema.safeParse(parsedBody.body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, isPublic } = validation.data

    const result = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title,
          ...(description !== undefined ? { description } : {}),
          ...(isPublic !== undefined ? { isPublic } : {}),
          authorId: session.user.id,
        },
      })

      return tree
    })

    return NextResponse.json(createSuccessResponse(result), { status: 201 })
  } catch (error) {
    console.error('[POST /api/trees]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

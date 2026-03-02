import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeCreateSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const treeId = searchParams.get('treeId')
    const isPublic = searchParams.get('isPublic') === 'true'

    const session = await auth()
    const userId = session?.user?.id

    const trees = await prisma.tree.findMany({
      where: {
        ...(isPublic ? { isPublic: true } : {}),
        ...(treeId ? { id: treeId } : {}),
      },
      include: {
        _count: { select: { nodes: true } },
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

    const body = await request.json()
    const validation = TreeCreateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0].message, 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { title, description, isPublic } = validation.data

    const result = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title,
          description,
          isPublic,
          authorId: session.user.id,
        },
      })

      return tree
    })

    return NextResponse.json(createSuccessResponse(result))
  } catch (error) {
    console.error('[POST /api/trees]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

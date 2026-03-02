import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    const { topic, nodeCount } = body

    if (!topic) {
      return NextResponse.json(
        createErrorResponse('Topic is required', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    // TODO P2: реализовать генерацию через Gemini API или Groq
    const mockResponse = {
      treeId: 'mock-tree-id',
      title: `Навык: ${topic}`,
      nodes: [
        {
          id: 'node-1',
          title: 'Основы ' + topic,
          description: 'Введение в ' + topic,
          difficulty: 1,
        },
      ],
    }

    return NextResponse.json(createSuccessResponse(mockResponse))
  } catch (error) {
    console.error('[POST /api/ai/generate]', error)
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

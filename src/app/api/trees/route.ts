import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { TreeCreateSchema } from '@/entities/tree/model/schemas'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/shared/lib/rateLimit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Пагинация каталога: дефолт и максимум на страницу. */
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type TreeSortMode = 'newest' | 'popular'

/**
 * GET /api/trees — листинг деревьев с пагинацией.
 *
 * Параметры:
 * - scope=public|mine (обязателен) — публичный каталог или «мои деревья»;
 * - page (>=1, default 1), limit (1..100, default 20);
 * - sort=newest|popular (default newest) — популярность по числу отметок прогресса;
 * - search — поиск по названию/описанию (только для scope=public).
 *
 * Кэширование (осознанное решение, без отдельного кэш-слоя):
 * - scope=public — умеренно динамичные данные: отдаём Cache-Control с
 *   s-maxage=30 + stale-while-revalidate=120 (CDN/прокси держат короткий кэш);
 * - scope=mine и всё персонализированное — no-store.
 */
export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
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

    // Пагинация: page >= 1, limit 1..100 (защита от аномальных значений).
    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const limitRaw = Number(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, limitRaw))

    const sort: TreeSortMode = searchParams.get('sort') === 'popular' ? 'popular' : 'newest'
    const search = searchParams.get('search')?.trim() ?? ''

    let where: { isPublic?: boolean; authorId?: string; OR?: Array<Record<string, unknown>> }

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
      if (search) {
        // Поиск выполняется на сервере: при пагинации клиентский фильтр
        // «по всем деревьям» невозможен (видит только текущую страницу).
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ]
      }
    }

    const [trees, total] = await prisma.$transaction([
      prisma.tree.findMany({
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
        // newest → индекс Tree(isPublic, createdAt DESC).
        // popular → агрегат по числу прогрессов (без фильтра completed: orderBy
        // по отфильтрованному count в Prisma не поддерживается; на текущем
        // масштабе разница несущественна, задокументировано в ARCHITECTURE.md).
        orderBy:
          sort === 'popular'
            ? [{ progresses: { _count: 'desc' } }, { createdAt: 'desc' }]
            : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tree.count({ where }),
    ])

    const response = NextResponse.json(
      createSuccessResponse({
        items: trees,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    )

    // Cache-Control выбирается по scope (см. док-комментарий выше).
    response.headers.set(
      'Cache-Control',
      scope === 'public'
        ? 'public, s-maxage=30, stale-while-revalidate=120'
        : 'private, no-store'
    )
    response.headers.set('X-Request-Id', requestId)

    return response
  } catch (error) {
    logApiError('GET /api/trees', error, { requestId })
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

    // Rate limit: не даём заспамить создание деревьев.
    const rateLimit = checkRateLimit(`tree-create:${session.user.id}`, RATE_LIMITS.treeCreate)
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit)
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

    // Бизнес-событие для будущей аналитики (см. logEvent в shared/lib/logger).
    logEvent('tree_created', {
      userId: session.user.id,
      treeId: result.id,
      requestId: getRequestId(request),
    })

    return NextResponse.json(createSuccessResponse(result), { status: 201 })
  } catch (error) {
    logApiError('POST /api/trees', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Internal server error', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}

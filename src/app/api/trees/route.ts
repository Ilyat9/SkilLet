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
import { TREE_CATEGORIES } from '@/shared/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Пагинация каталога: дефолт и максимум на страницу. */
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

type TreeSortMode = 'newest' | 'popular'

/** Границы диапазона сложности для фильтра каталога (совпадают со схемой узлов). */
const MIN_DIFFICULTY = 1
const MAX_DIFFICULTY = 10

/**
 * GET /api/trees — листинг деревьев с пагинацией.
 *
 * Параметры:
 * - scope=public|mine (обязателен) — публичный каталог или «мои деревья»;
 * - page (>=1, default 1), limit (1..100, default 20);
 * - sort=newest|popular (default newest) — популярность по числу лайков;
 * - search — поиск по названию/описанию (только для scope=public);
 * - category — фильтр по категории (enum TreeCategory, только для scope=public);
 * - minDifficulty / maxDifficulty — фильтр по СРЕДНЕЙ сложности узлов дерева.
 *
 * Кэширование (осознанное решение, без отдельного кэш-слоя):
 * - scope=public — умеренно динамичные данные: отдаём Cache-Control с
 *   s-maxage=30 + stale-while-revalidate=120 (CDN/прокси держат короткий кэш);
 * - scope=mine и всё персонализированное (likedByMe) — no-store.
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
    const category = searchParams.get('category')?.trim() ?? ''
    const minDifficulty = Number(searchParams.get('minDifficulty'))
    const maxDifficulty = Number(searchParams.get('maxDifficulty'))

    // Сессия нужна и для scope=mine, и для персонального флага likedByMe.
    const session = await auth()
    const userId = session?.user?.id

    let where: {
      isPublic?: boolean
      authorId?: string
      category?: (typeof TREE_CATEGORIES)[number]
      OR?: Array<Record<string, unknown>>
      id?: { in: string[] }
    } = {}

    if (scope === 'mine') {
      if (!userId) {
        return NextResponse.json(
          createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
          { status: 401 }
        )
      }
      where = { authorId: userId }
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
      // Умная фильтрация по категории: enum валидируется списком —
      // неизвестное значение просто игнорируется (пустой фильтр = «все»).
      if (category && (TREE_CATEGORIES as readonly string[]).includes(category)) {
        where.category = category as (typeof TREE_CATEGORIES)[number]
      }
    }

    // Фильтр по диапазону СРЕДНЕЙ сложности дерева: агрегат по узлам выполняется
    // заранее (groupBy + JS-фильтр вместо SQL HAVING — совместимо и прозрачно),
    // результат — список treeId в диапазоне.
    if (Number.isFinite(minDifficulty) || Number.isFinite(maxDifficulty)) {
      const lo = Number.isFinite(minDifficulty) ? Math.max(MIN_DIFFICULTY, minDifficulty) : MIN_DIFFICULTY
      const hi = Number.isFinite(maxDifficulty) ? Math.min(MAX_DIFFICULTY, maxDifficulty) : MAX_DIFFICULTY
      if (lo <= hi) {
        const groups = await prisma.node.groupBy({
          by: ['treeId'],
          _avg: { difficulty: true },
        })
        const treeIdsInRange = groups
          .filter((g) => {
            const avg = g._avg.difficulty ?? 0
            return avg >= lo && avg <= hi
          })
          .map((g) => g.treeId)
        where = { ...where, id: { in: treeIdsInRange } }
      }
    }

    const [trees, total] = await prisma.$transaction([
      prisma.tree.findMany({
        where,
        include: {
          _count: {
            select: {
              nodes: true,
              // Метрика активности: количество отметок прогресса.
              progresses: { where: { completed: true } },
              edges: true,
              // Честная метрика популярности каталога — лайки сообщества.
              likes: true,
            },
          },
          author: {
            select: { id: true, name: true, image: true },
          },
        },
        // newest → индекс Tree(isPublic, createdAt DESC) / (+category).
        // popular → сортировка по числу лайков (TreeLike с @@index([treeId])),
        // createdAt — tiebreaker.
        orderBy:
          sort === 'popular'
            ? [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]
            : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tree.count({ where }),
    ])

    const treeIds = trees.map((tree) => tree.id)

    // Статистика сложности узлов (avg/min/max) страницы каталога — один
    // groupBy по treeId вместо N запросов.
    const difficultyGroups = treeIds.length
      ? await prisma.node.groupBy({
          by: ['treeId'],
          where: { treeId: { in: treeIds } },
          _avg: { difficulty: true },
          _min: { difficulty: true },
          _max: { difficulty: true },
        })
      : []
    const difficultyByTree = new Map(
      difficultyGroups.map((g) => [
        g.treeId,
        {
          avg: Math.round((g._avg.difficulty ?? 0) * 10) / 10,
          min: g._min.difficulty ?? 0,
          max: g._max.difficulty ?? 0,
        },
      ])
    )

    // Персональный флаг likedByMe — один запрос по странице деревьев.
    const likedIds =
      userId && treeIds.length
        ? new Set(
            (
              await prisma.treeLike.findMany({
                where: { userId, treeId: { in: treeIds } },
                select: { treeId: true },
              })
            ).map((like) => like.treeId)
          )
        : new Set<string>()

    const items = trees.map((tree) => ({
      ...tree,
      difficultyStats: difficultyByTree.get(tree.id) ?? { avg: 0, min: 0, max: 0 },
      likedByMe: likedIds.has(tree.id),
    }))

    const response = NextResponse.json(
      createSuccessResponse({
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      })
    )

    // Cache-Control выбирается по scope (см. док-комментарий выше). likedByMe
    // персонален — при авторизации публичный листинг тоже не кэшируем.
    response.headers.set(
      'Cache-Control',
      scope === 'public' && !userId
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

    const { title, description, category, isPublic } = validation.data

    const result = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title,
          ...(description !== undefined ? { description } : {}),
          ...(category !== undefined ? { category } : {}),
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

import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit, RATE_LIMITS } from '@/shared/lib/rateLimit'
import { hasCycle } from '@/shared/lib/dag'
import { NODE_POSITION_LIMIT } from '@/shared/constants'
import { TreeCategorySchema } from '@/entities/tree/model/schemas'

/**
 * РЕШЕНИЕ ПО AI-ГЕНЕРАЦИИ (вариант «б» — реальная реализация).
 *
 * Фича доведена до рабочего состояния, а не вырезана: она даёт ключевой
 * wow-эффект для презентации (дерево навыков по любой теме за один запрос)
 * при небольших затратах на интеграцию.
 *
 * Вызов LLM выполняется напрямую через fetch к OpenAI-совместимому
 * Chat Completions API без дополнительного SDK. Конфигурация через .env:
 *   - OPENAI_API_KEY  — обязателен; без него эндпоинт честно отвечает
 *     503 AI_NOT_CONFIGURED (предсказуемая деградация вместо падения);
 *   - OPENAI_BASE_URL — опционально (совместимые провайдеры, напр. OpenRouter);
 *   - OPENAI_MODEL    — опционально, по умолчанию gpt-4o-mini;
 *   - OPENAI_FALLBACK_MODELS — опционально, список резервных моделей через
 *     запятую. Если не задан, используется встроенный список бесплатных
 *     моделей OpenRouter (актуализирован 2026-08, все поддерживают
 *     response_format: json_object) — см. DEFAULT_FALLBACK_MODELS ниже.
 *
 * Фолбэк-механика: если основная модель недоступна (провайдер убрал модель,
 * 4xx/5xx, таймаут) — сервер автоматически пробует следующую модель из цепочки,
 * поэтому генерация не ломается из-за исчезновения одной модели у провайдера.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Не чаще нескольких генераций в минуту на пользователя (см. RATE_LIMITS.aiGenerate). */
/** Таймаут одного запроса к LLM — чтобы запрос не висел неопределённо. */
const LLM_TIMEOUT_MS = 30_000
/** Сообщение при таймауте LLM: пользовательский ответ маппится в 504. */
const LLM_TIMEOUT_DESCRIPTION = 'AI-сервис не ответил за 30 секунд'
/**
 * Общий дедлайн всей цепочки моделей (включая фолбэки): ограничивает худший
 * случай, чтобы Serverless Function не упёрлась в лимит времени платформы.
 */
const TOTAL_DEADLINE_MS = 55_000

/** Максимум попыток получить валидный JSON от модели. */
const MAX_ATTEMPTS = 2

const GenerateRequestSchema = z.object({
  topic: z.string().min(3, 'Тема слишком короткая').max(200, 'Слишком длинная тема'),
  // Категория дерева: необязательна — без неё дерево сохранится как OTHER.
  category: TreeCategorySchema.optional(),
})

const AiNodeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  difficulty: z.number().int().min(1).max(10),
  positionX: z.number(),
  positionY: z.number(),
  resourceType: z.enum(['video', 'article']).optional(),
  resourceUrl: z.string().url().optional(),
  resourceTitle: z.string().max(200).optional(),
})

const AiTreeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  nodes: z.array(AiNodeSchema).min(8, 'Должно быть 8–20 узлов').max(20),
  connections: z.array(z.tuple([z.number().int(), z.number().int()])),
})

type AiTreeResponse = z.infer<typeof AiTreeSchema>

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

const OPENAI_API_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

/**
 * Встроенные резервные модели (бесплатный тир OpenRouter, проверены 2026-08:
 * все заявляют поддержку response_format/structured_outputs). Порядок —
 * от крупной к меньшей: сначала мощные модели, слабые — в конце.
 * Список обновляется вручную по мере ротации бесплатного тира:
 *   curl -s https://openrouter.ai/api/v1/models | фильтр по ':free'
 */
const DEFAULT_FALLBACK_MODELS = [
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'minimax/minimax-m3:free',
  'google/gemma-4-31b-it:free',
] as const
/** Первая (самая мощная) бесплатная модель — дефолт для OpenRouter. */
const OPENROUTER_DEFAULT_MODEL: string = DEFAULT_FALLBACK_MODELS[0]

/**
 * Основная модель. Пустая строка в env трактуется как «не задана» (?? не ловит
 * '', поэтому — через trim+||). Для OpenRouter дефолт — бесплатная модель:
 * платные (без суффикса :free) на дефолте не используются, чтобы пустое поле
 * OPENAI_MODEL в env не приводило к списаниям кредитов.
 */
const USING_OPENROUTER = OPENAI_API_URL.includes('openrouter')
const OPENAI_MODEL =
  process.env.OPENAI_MODEL?.trim() || (USING_OPENROUTER ? OPENROUTER_DEFAULT_MODEL : 'gpt-4o-mini')

/** Цепочка моделей: основная → заданные в env → встроенные бесплатные. Дубликаты убираются. */
const MODEL_CHAIN: readonly string[] = Array.from(
  new Set([
    OPENAI_MODEL,
    ...(process.env.OPENAI_FALLBACK_MODELS !== undefined
      ? process.env.OPENAI_FALLBACK_MODELS.split(',').map((m) => m.trim()).filter(Boolean)
      : DEFAULT_FALLBACK_MODELS),
  ])
)

function clampCoordinate(value: number): number {
  return Math.max(-NODE_POSITION_LIMIT, Math.min(NODE_POSITION_LIMIT, Math.round(value)))
}

/**
 * Раскладка узлов AI-дерева. Координатам от LLM доверия нет (типичный шаг
 * сетки ~100px при карточке 224px — узлы наезжают друг на друга), поэтому
 * позиция считается из графа связей: слои по самому длинному пути от корней,
 * внутри слоя — рядами. Шаг X=250/Y=220 подобран под карточку w-56 (~224px)
 * и гарантирует укладку в лимит ±1000 до 8 колонок на ряд.
 */
function layoutAiNodes(nodes: AiTreeResponse['nodes'], edges: readonly DagEdge[]): { x: number; y: number }[] {
  const count = nodes.length
  const incoming = new Array<number>(count).fill(0)
  const children: number[][] = nodes.map(() => [])
  for (const edge of edges) {
    const from = Number(edge.sourceId)
    const to = Number(edge.targetId)
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= count || to >= count) continue
    incoming[to] = (incoming[to] ?? 0) + 1
    children[from]?.push(to)
  }

  // Слой узла = самый длинный путь от корня (слой корней — 0).
  const layer = new Array<number>(count).fill(0)
  const remaining = [...incoming]
  const queue = nodes.map((_, i) => i).filter((i) => incoming[i] === 0)
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head] ?? 0
    for (const next of children[cur] ?? []) {
      if (layer[next] !== undefined && layer[next] < (layer[cur] ?? 0) + 1) layer[next] = (layer[cur] ?? 0) + 1
      remaining[next] = (remaining[next] ?? 0) - 1
      if (remaining[next] === 0) queue.push(next)
    }
  }

  // Внутри слоя — рядами не более 8 колонок, центрирование по X.
  const MAX_COLS = 8
  const STEP_X = 250
  const STEP_Y = 220
  const byLayer = new Map<number, number[]>()
  nodes.forEach((_, i) => {
    const arr = byLayer.get(layer[i] ?? 0) ?? []
    arr.push(i)
    byLayer.set(layer[i] ?? 0, arr)
  })

  const result: { x: number; y: number }[] = nodes.map(() => ({ x: 0, y: 0 }))
  let yCursor = 0
  for (const l of [...byLayer.keys()].sort((a, b) => a - b)) {
    const idxs = byLayer.get(l) ?? []
    for (let rowStart = 0; rowStart < idxs.length; rowStart += MAX_COLS) {
      const row = idxs.slice(rowStart, rowStart + MAX_COLS)
      const offset = ((row.length - 1) / 2) * STEP_X
      row.forEach((nodeIdx, col) => {
        result[nodeIdx] = { x: col * STEP_X - offset, y: yCursor }
      })
      yCursor += STEP_Y
    }
  }
  return result
}

/** Нормализует ответ LLM: зажимает координаты/числа в допустимые границы схемы узлов. */
function normalizeAiTree(raw: AiTreeResponse): AiTreeResponse {
  return {
    ...raw,
    nodes: raw.nodes.map((node) => ({
      ...node,
      positionX: clampCoordinate(node.positionX),
      positionY: clampCoordinate(node.positionY),
      difficulty: Math.max(1, Math.min(10, node.difficulty)),
    })),
  }
}

interface DagEdge {
  sourceId: string
  targetId: string
}

/**
 * Фильтрует связи от модели: отбрасывает самопетли, дубликаты,
 * выходы за индексы и рёбра, создающие цикл. DAG-инвариант дерева сохраняется.
 */
function filterAcyclicConnections(nodesCount: number, connections: Array<[number, number]>): DagEdge[] {
  const accepted: DagEdge[] = []

  for (const [sourceIndex, targetIndex] of connections) {
    if (sourceIndex === targetIndex) continue
    if (sourceIndex < 0 || sourceIndex >= nodesCount) continue
    if (targetIndex < 0 || targetIndex >= nodesCount) continue

    const sourceId = String(sourceIndex)
    const targetId = String(targetIndex)

    if (accepted.some((e) => e.sourceId === sourceId && e.targetId === targetId)) continue

    // Общий DAG-хелпер проекта: добавляем ребро, только если цикл не образуется.
    if (hasCycle(accepted.map((e) => ({ ...e, treeId: 'ai-tree' })), sourceId, targetId)) continue

    accepted.push({ sourceId, targetId })
  }

  return accepted
}

/** Достаёт JSON из ответа модели даже если он завёрнут в ```json-блок. */
function extractJson(raw: string): unknown {
  const fencedMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fencedMatch?.[1] ? fencedMatch[1] : raw
  return JSON.parse(jsonText.trim()) as unknown
}

async function callLlm(topic: string, model: string, stricterInstruction?: string): Promise<string> {
  const systemPrompt =
    'Ты методист обучающих skill-tree. Возвращай СТРОГО валидный JSON без markdown-обёрток, комментариев и пояснений. Только JSON.'

  let userPrompt =
    `Составь план обучения по теме "${topic}" в виде дерева навыков.\n` +
    'Формат JSON:\n' +
    '{\n' +
    '  "title": "название дерева (до 200 символов)",\n' +
    '  "description": "краткое описание (до 1000 символов)",\n' +
    '  "nodes": [\n' +
    '    {\n' +
    '      "title": "...",\n' +
    '      "description": "...",\n' +
    '      "difficulty": число 1-10,\n' +
    '      "positionX": число,\n' +
    '      "positionY": число,\n' +
    '      "resourceType": "video" или "article" (опционально),\n' +
    '      "resourceUrl": "https://..." (опционально),\n' +
    '      "resourceTitle": "..." (опционально)\n' +
    '    }\n' +
    '  ],\n' +
    '  "connections": [[индекс узла-источника, индекс узла-цели], ...]\n' +
    '}\n' +
    'Требования: 8–20 узлов; первый узел — стартовый без входящих связей; связи образуют DAG без циклов;\n' +
    'сложность растёт от старта к финалу; координаты идут сеткой с шагом ~150 по X и Y;\n' +
    'где уместно добавляй один ресурс (официальную документацию или видео) с корректным https-URL.'

  if (stricterInstruction) {
    userPrompt += `\n\nПРЕДЫДУЩАЯ ПОПЫТКА ОТКЛОНЕНА: ${stricterInstruction}\nВерни исправленный JSON, строго соответствующий формату выше.`
  }

  const response = await fetch(`${OPENAI_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
    // Явный таймаут внешнего вызова: без него зависший провайдер держит запрос открытым.
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`LLM API вернул статус ${response.status}`)
  }

  const payload = (await response.json()) as ChatCompletionResponse
  const content = payload.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('LLM вернул пустой ответ')
  }
  return content
}

/**
 * Пытается получить валидное дерево, перебирая MODEL_CHAIN: для каждой модели —
 * до MAX_ATTEMPTS попыток (повторная — с более строгим промтом и описанием
 * ошибки предыдущей). Модель, которая упала (4xx/5xx, таймаут, стабильно
 * невалидный JSON), пропускается — запрос уходит следующей. Так генерация
 * переживает исчезновение модели у провайдера без правок кода.
 */
async function generateValidatedTree(
  topic: string
): Promise<{ tree: AiTreeResponse; model: string } | { error: string; timedOut?: boolean }> {
  let lastErrorDescription = ''
  const startedAt = Date.now()

  for (const model of MODEL_CHAIN) {
    let moveToNextModel = false

    // Общий дедлайн цепочки: если время почти вышло — не начинаем новую модель.
    if (Date.now() - startedAt > TOTAL_DEADLINE_MS) break

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !moveToNextModel; attempt += 1) {
      try {
        const rawContent = await callLlm(topic, model, attempt > 1 ? lastErrorDescription : undefined)

        const parsed = AiTreeSchema.safeParse(extractJson(rawContent))
        if (parsed.success) {
          return { tree: normalizeAiTree(parsed.data), model }
        }

        lastErrorDescription = parsed.error.errors[0]?.message ?? 'ответ не соответствует схеме'
      } catch (error) {
        // AbortSignal.timeout отклоняет fetch с DOMException TimeoutError.
        if (error instanceof Error && error.name === 'TimeoutError') {
          lastErrorDescription = `${LLM_TIMEOUT_DESCRIPTION} (${model})`
          // Таймаут конкретной модели не ретраим — сразу пробуем следующую.
          moveToNextModel = true
          break
        }
        lastErrorDescription = error instanceof Error ? error.message : 'неизвестная ошибка запроса к модели'
        // Ошибка провайдера (модель удалена, 404/410/5xx) — ретраить ту же
        // модель бессмысленно, переходим к следующей.
        moveToNextModel = true
        break
      }
    }
  }

  return { error: lastErrorDescription }
}

// POST /api/ai/generate — генерация дерева навыков по теме через LLM.
export async function POST(request: NextRequest) {
  try {
    const requestId = getRequestId(request)
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        createErrorResponse('Unauthorized', 'UNAUTHORIZED'),
        { status: 401 }
      )
    }
    const userId = session.user.id

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        createErrorResponse(
          'AI-генерация недоступна: не настроен OPENAI_API_KEY. Добавьте ключ в .env и перезапустите сервер.',
          'AI_NOT_CONFIGURED'
        ),
        { status: 503 }
      )
    }

    const rateLimit = checkRateLimit(`ai-generate:${userId}`, RATE_LIMITS.aiGenerate)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        createErrorResponse(
          `Слишком часто: попробуйте ещё раз через ${Math.ceil(rateLimit.retryAfterMs / 1000)} c.`,
          'RATE_LIMITED'
        ),
        { status: 429 }
      )
    }

    const parsedBody = await parseJsonBody(request)
    if (parsedBody.error) return parsedBody.error

    const validation = GenerateRequestSchema.safeParse(parsedBody.body)
    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse(validation.error.errors[0]?.message ?? 'Ошибка валидации', 'VALIDATION_ERROR'),
        { status: 400 }
      )
    }

    const { topic, category } = validation.data
    const generation = await generateValidatedTree(topic)

    if ('error' in generation) {
      logApiError('POST /api/ai/generate', generation.error, {
        requestId,
        userId,
        detail: generation.timedOut ? 'таймаут LLM' : 'модель вернула невалидный ответ',
      })
      return NextResponse.json(
        createErrorResponse(
          generation.timedOut
            ? `${LLM_TIMEOUT_DESCRIPTION}. Попробуйте ещё раз позже.`
            : 'Модель не смогла вернуть корректное дерево. Попробуйте переформулировать тему.',
          generation.timedOut ? 'AI_TIMEOUT' : 'AI_GENERATION_FAILED'
        ),
        { status: generation.timedOut ? 504 : 502 }
      )
    }

    const aiTree = generation.tree
    const acceptedConnections = filterAcyclicConnections(aiTree.nodes.length, aiTree.connections)

    // Раскладка считается сервером из графа связей — координаты LLM не используются.
    const layout = layoutAiNodes(aiTree.nodes, acceptedConnections)

    // Сохраняем одной транзакцией: Tree → вложенный create Node[] → createMany Edge[]
    // (тот же паттерн, что в prisma/seed.ts).
    const treeId = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title: aiTree.title,
          ...(aiTree.description !== undefined ? { description: aiTree.description } : {}),
          ...(category !== undefined ? { category } : {}),
          isPublic: true,
          authorId: userId,
          nodes: {
            create: aiTree.nodes.map((node, nodeIndex) => ({
              title: node.title,
              description: node.description ?? null,
              positionX: clampCoordinate(layout[nodeIndex]?.x ?? 0),
              positionY: clampCoordinate(layout[nodeIndex]?.y ?? 0),
              difficulty: node.difficulty,
              resources:
                node.resourceType && node.resourceUrl && node.resourceTitle
                  ? [{ type: node.resourceType, url: node.resourceUrl, title: node.resourceTitle }]
                  : [],
            })),
          },
        },
        include: { nodes: true },
      })

      // Маппинг индекс → реальный id узла в БД.
      const idByIndex = new Map<number, string>()
      for (let index = 0; index < aiTree.nodes.length; index += 1) {
        const createdNode = tree.nodes[index]
        if (createdNode) idByIndex.set(index, createdNode.id)
      }

      const edgesData = acceptedConnections
        .map(({ sourceId: sourceIndexKey, targetId: targetIndexKey }) => ({
          treeId: tree.id,
          sourceId: idByIndex.get(Number(sourceIndexKey)),
          targetId: idByIndex.get(Number(targetIndexKey)),
        }))
        .filter((edge): edge is { treeId: string; sourceId: string; targetId: string } =>
          Boolean(edge.sourceId && edge.targetId)
        )

      if (edgesData.length > 0) {
        await tx.edge.createMany({ data: edgesData })
      }

      return tree.id
    })

    logEvent('ai_tree_generated', {
      userId,
      treeId,
      nodesCount: aiTree.nodes.length,
      topicLength: topic.length,
      model: generation.model,
      requestId,
    })

    return NextResponse.json(
      createSuccessResponse({ treeId, nodesCount: aiTree.nodes.length }),
      { status: 201 }
    )
  } catch (error) {
    logApiError('POST /api/ai/generate', error, { requestId: getRequestId(request) })
    return NextResponse.json(
      createErrorResponse('Ошибка AI-генерации', 'INTERNAL_ERROR'),
      { status: 500 }
    )
  }
}



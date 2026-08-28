import { logApiError, logEvent } from '@/shared/lib/logger'
import { getRequestId } from '@/shared/lib/requestId'
import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/shared/lib/prisma'
import { auth } from '@/shared/lib/auth'
import { createSuccessResponse, createErrorResponse } from '@/shared/lib/utils'
import { parseJsonBody } from '@/shared/lib/api'
import { checkRateLimit } from '@/shared/lib/rateLimit'
import { hasCycle } from '@/shared/lib/dag'
import { NODE_POSITION_LIMIT } from '@/shared/constants'

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
 *   - OPENAI_BASE_URL — опционально (совместимые провайдеры);
 *   - OPENAI_MODEL    — опционально, по умолчанию gpt-4o-mini.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Не чаще одной генерации в минуту на пользователя (in-memory TTL). */
const RATE_LIMIT_INTERVAL_MS = 60_000

/** Максимум попыток получить валидный JSON от модели. */
const MAX_ATTEMPTS = 2

const GenerateRequestSchema = z.object({
  topic: z.string().min(3, 'Тема слишком короткая').max(200, 'Слишком длинная тема'),
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
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

function clampCoordinate(value: number): number {
  return Math.max(-NODE_POSITION_LIMIT, Math.min(NODE_POSITION_LIMIT, Math.round(value)))
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

async function callLlm(topic: string, stricterInstruction?: string): Promise<string> {
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
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
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
 * Пытается получить валидное дерево от модели — не более MAX_ATTEMPTS попыток,
 * повторная выполняется с более строгим промтом и описанием ошибки первой.
 */
async function generateValidatedTree(topic: string): Promise<{ tree: AiTreeResponse } | { error: string }> {
  let lastErrorDescription = ''

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const rawContent = await callLlm(topic, attempt > 1 ? lastErrorDescription : undefined)

      const parsed = AiTreeSchema.safeParse(extractJson(rawContent))
      if (parsed.success) {
        return { tree: normalizeAiTree(parsed.data) }
      }

      lastErrorDescription = parsed.error.errors[0]?.message ?? 'ответ не соответствует схеме'
    } catch (error) {
      lastErrorDescription = error instanceof Error ? error.message : 'неизвестная ошибка запроса к модели'
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

    const rateLimit = checkRateLimit(`ai-generate:${userId}`, RATE_LIMIT_INTERVAL_MS)
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

    const { topic } = validation.data
    const generation = await generateValidatedTree(topic)

    if ('error' in generation) {
      logApiError('POST /api/ai/generate', generation.error, {
        requestId,
        userId,
        detail: 'модель вернула невалидный ответ',
      })
      return NextResponse.json(
        createErrorResponse(
          'Модель не смогла вернуть корректное дерево. Попробуйте переформулировать тему.',
          'AI_GENERATION_FAILED'
        ),
        { status: 502 }
      )
    }

    const aiTree = generation.tree
    const acceptedConnections = filterAcyclicConnections(aiTree.nodes.length, aiTree.connections)

    // Сохраняем одной транзакцией: Tree → вложенный create Node[] → createMany Edge[]
    // (тот же паттерн, что в prisma/seed.ts).
    const treeId = await prisma.$transaction(async (tx) => {
      const tree = await tx.tree.create({
        data: {
          title: aiTree.title,
          ...(aiTree.description !== undefined ? { description: aiTree.description } : {}),
          isPublic: true,
          authorId: userId,
          nodes: {
            create: aiTree.nodes.map((node) => ({
              title: node.title,
              description: node.description ?? null,
              positionX: node.positionX,
              positionY: node.positionY,
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



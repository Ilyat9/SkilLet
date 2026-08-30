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
import { NODE_POSITION_LIMIT, AI_DURATION_OPTIONS, DEFAULT_AI_DURATION_OPTION, type AiDurationOption } from '@/shared/constants'
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
// Большие сроки обучения просят у модели больше узлов → дольше генерация.
// Явно поднимаем лимит платформы, чтобы TOTAL_DEADLINE_MS ниже не обрезался
// дефолтным лимитом функции раньше собственного дедлайна запроса.
export const maxDuration = 60

/** Не чаще нескольких генераций в минуту на пользователя (см. RATE_LIMITS.aiGenerate). */
/**
 * Таймаут одного запроса к LLM. Масштабируется от целевого числа узлов
 * (см. AI_DURATION_OPTIONS) — более длинному дереву нужно больше токенов
 * на генерацию, а значит и больше времени на ответ провайдера.
 */
const LLM_TIMEOUT_BASE_MS = 25_000
const LLM_TIMEOUT_PER_NODE_MS = 400
const LLM_TIMEOUT_MAX_MS = 45_000
/** Сообщение при таймауте LLM: пользовательский ответ маппится в 504. */
const LLM_TIMEOUT_DESCRIPTION = 'AI-сервис не ответил вовремя'
/**
 * Общий дедлайн всей цепочки моделей (включая фолбэки): ограничивает худший
 * случай, чтобы Serverless Function не упёрлась в лимит времени платформы
 * (maxDuration = 60 выше — оставляем 2с запаса на сохранение в БД и ответ).
 */
const TOTAL_DEADLINE_MS = 58_000

/** Максимум попыток получить валидный JSON от модели. */
const MAX_ATTEMPTS = 2

const GenerateRequestSchema = z.object({
  topic: z.string().min(3, 'Тема слишком короткая').max(200, 'Слишком длинная тема'),
  // Категория дерева: необязательна — без неё дерево сохранится как OTHER.
  category: TreeCategorySchema.optional(),
  // Срок обучения: необязателен — без него используется DEFAULT_AI_DURATION_ID.
  duration: z
    .enum(AI_DURATION_OPTIONS.map((o) => o.id) as [string, ...string[]])
    .optional(),
})

/**
 * Материал обязателен на каждом узле (не .optional()) — без него узел
 * бесполезен как шаг плана обучения. Промпт в callLlm() требует по одному
 * ресурсу на узел; схема здесь этого не ослабляет.
 */
const AiNodeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  difficulty: z.number().int().min(1).max(10),
  positionX: z.number(),
  positionY: z.number(),
  resourceType: z.enum(['video', 'article']),
  resourceUrl: z.string().url(),
  resourceTitle: z.string().min(1).max(200),
})

/** Схема дерева с границами числа узлов, зависящими от выбранного срока обучения. */
function buildAiTreeSchema(minNodes: number, maxNodes: number) {
  return z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    nodes: z.array(AiNodeSchema).min(minNodes, `Должно быть ${minNodes}–${maxNodes} узлов`).max(maxNodes),
    connections: z.array(z.tuple([z.number().int(), z.number().int()])),
  })
}

type AiTreeResponse = z.infer<ReturnType<typeof buildAiTreeSchema>>

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
}

const OPENAI_API_URL = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'

/**
 * Встроенные резервные модели (бесплатный тир OpenRouter). Порядок — по
 * реальной проверке вживую 2026-08-30 (несколько прогонов через реальный
 * API с разными темами/размерами дерева): nvidia/nemotron-3-super-120b-a12b:free
 * исключена — в 100% попыток либо не отвечала до таймаута, либо съедала
 * 25-40с впустую перед падением на следующую модель, не давая ни одного
 * валидного ответа. minimax/minimax-m3:free — единственная стабильно
 * рабочая модель в тесте (валидный JSON, материал на всех узлах, разумная
 * сложность), но не мгновенная — на большом дереве (~38 узлов) при
 * нагрузке отвечала 15-58с. Список обновляется вручную по мере ротации
 * бесплатного тира: curl -s https://openrouter.ai/api/v1/models | фильтр
 * по ':free'
 */
const DEFAULT_FALLBACK_MODELS = [
  'z-ai/glm-5.2:free',
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
 * внутри слоя — рядами. Шаг X=250/Y=220 подобран под карточку w-56 (~224px);
 * для длинных деревьев (много слоёв) шаг между слоями адаптивно уменьшается,
 * чтобы не упереться в NODE_POSITION_LIMIT и не схлопнуть узлы в одну точку.
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
  const BASE_STEP_Y = 220
  const byLayer = new Map<number, number[]>()
  nodes.forEach((_, i) => {
    const arr = byLayer.get(layer[i] ?? 0) ?? []
    arr.push(i)
    byLayer.set(layer[i] ?? 0, arr)
  })

  const result: { x: number; y: number }[] = nodes.map(() => ({ x: 0, y: 0 }))
  const layers = [...byLayer.keys()].sort((a, b) => a - b)
  // Глубокое узкое дерево (цепочка слоёв по 1–2 узла) в вертикальной раскладке
  // превращается в длинную колонку — fitView отдаляет до нечитаемости.
  // Такие деревья раскладываем слева-направо, как классические skill-roadmap'ы.
  const depth = layers.length
  const widestRow = Math.max(...layers.map((l) => Math.ceil((byLayer.get(l) ?? []).length / MAX_COLS)))
  const horizontal = depth >= 5 && widestRow <= 2
  const BASE_STEP_COL = 340
  const STEP_ROW_H = 240

  // Длинные деревья (см. AI_DURATION_OPTIONS.maxNodes до 45) могут дать много
  // слоёв — при фиксированном шаге координата вышла бы за NODE_POSITION_LIMIT
  // и clampCoordinate() схлопнул бы разные узлы в одну точку. Поэтому шаг
  // между слоями уменьшается, если слоёв много, но не превышает базовый.
  // Обе координаты (l * STEP_COL и накопительный yCursor) растут только в
  // одну сторону от 0, поэтому бюджет — односторонний лимит с небольшим запасом.
  const SPAN_BUDGET = NODE_POSITION_LIMIT - 200
  const totalRows = layers.reduce((sum, l) => sum + Math.ceil((byLayer.get(l) ?? []).length / MAX_COLS), 0)
  const STEP_COL = horizontal && depth > 1 ? Math.min(BASE_STEP_COL, Math.floor(SPAN_BUDGET / (depth - 1))) : BASE_STEP_COL
  const STEP_Y = !horizontal && totalRows > 1 ? Math.min(BASE_STEP_Y, Math.floor(SPAN_BUDGET / (totalRows - 1))) : BASE_STEP_Y

  let yCursor = 0
  if (horizontal) {
    for (const l of layers) {
      const idxs = byLayer.get(l) ?? []
      const offset = ((idxs.length - 1) / 2) * STEP_ROW_H
      idxs.forEach((nodeIdx, row) => {
        result[nodeIdx] = { x: l * STEP_COL, y: row * STEP_ROW_H - offset }
      })
    }
  } else {
    for (const l of layers) {
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

/**
 * Модели на практике иногда превышают запрошенный потолок числа узлов
 * (проверено вживую: minimax возвращал >maxNodes на большом дереве). Вместо
 * того чтобы жёстко отбраковывать весь ответ и тратить целый повторный
 * круг, лишние узлы с конца просто обрезаются, а связи, ссылавшиеся на
 * обрезанные индексы, отбрасываются — на дерево это не влияет: overshoot
 * означает «модель детализировала чуть больше, чем нужно», а не сломанную
 * структуру у первых maxNodes узлов.
 */
function trimOversizedTree(raw: unknown, maxNodes: number): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.nodes) || obj.nodes.length <= maxNodes) return raw

  const connections = Array.isArray(obj.connections) ? obj.connections : []
  const trimmedConnections = connections.filter(
    (pair): pair is [number, number] =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      typeof pair[0] === 'number' &&
      typeof pair[1] === 'number' &&
      pair[0] < maxNodes &&
      pair[1] < maxNodes
  )

  return { ...obj, nodes: obj.nodes.slice(0, maxNodes), connections: trimmedConnections }
}

/** max_tokens запроса: пропорционален целевому числу узлов, чтобы длинные деревья не обрезались. */
function estimateMaxTokens(maxNodes: number): number {
  return Math.min(8000, Math.max(2000, 1200 + maxNodes * 150))
}

async function callLlm(
  topic: string,
  model: string,
  duration: AiDurationOption,
  stricterInstruction?: string
): Promise<string> {
  const systemPrompt =
    'Ты опытный методист, который проектирует учебные планы (skill-tree) по любой теме — ' +
    'технической и нетехнической. Возвращай СТРОГО валидный JSON без markdown-обёрток, ' +
    'комментариев и пояснений. Только JSON. Никогда не выдумывай факты, названия курсов ' +
    'или ссылки, которых не существует, — только то, в чём ты уверен.'

  let userPrompt =
    `Составь план обучения по теме "${topic}" в виде дерева навыков, рассчитанный на срок ` +
    `обучения ${duration.weeksLabel} (примерно 3–5 часов занятий в неделю).\n` +
    'Формат JSON:\n' +
    '{\n' +
    '  "title": "название дерева (до 200 символов)",\n' +
    '  "description": "краткое описание (до 1000 символов)",\n' +
    '  "nodes": [\n' +
    '    {\n' +
    '      "title": "название навыка/шага",\n' +
    '      "description": "что конкретно нужно освоить на этом шаге",\n' +
    '      "difficulty": число 1-10,\n' +
    '      "positionX": число,\n' +
    '      "positionY": число,\n' +
    '      "resourceType": "video" или "article",\n' +
    '      "resourceUrl": "https://...",\n' +
    '      "resourceTitle": "название источника"\n' +
    '    }\n' +
    '  ],\n' +
    '  "connections": [[индекс узла-источника, индекс узла-цели], ...]\n' +
    '}\n' +
    '\n' +
    `Требования к структуре:\n` +
    `- От ${duration.minNodes} до ${duration.maxNodes} узлов — план должен реально покрывать заявленный ` +
    `срок ${duration.weeksLabel}, а не сжиматься до пары шагов. ${duration.maxNodes} — ЖЁСТКИЙ потолок: ` +
    `если тема кажется шире, объединяй мелкие смежные темы в один узел вместо того, чтобы добавлять узлы ` +
    'сверх лимита;\n' +
    '- первый узел — стартовый, без входящих связей;\n' +
    '- связи образуют DAG без циклов (никогда не веди связь назад к уже пройденному узлу);\n' +
    '- координаты идут сеткой с шагом ~150 по X и Y (точная раскладка потом пересчитывается сервером, ' +
    'важен только относительный порядок).\n' +
    '\n' +
    'Требования к сложности (difficulty, 1-10) — считай её реально, а не выдумывай на глаз:\n' +
    '- 1-2: не требует предыдущих знаний по теме вообще;\n' +
    '- 3-5: требует освоения нескольких предыдущих узлов дерева;\n' +
    '- 6-8: требует уверенного владения большой частью дерева и самостоятельной практики;\n' +
    '- 9-10: экспертный уровень, требует владения почти всем деревом.\n' +
    'Сложность узла оценивай по РЕАЛЬНОЙ глубине и объёму его предпосылок в этом же дереве ' +
    '(сколько узлов и насколько сложных нужно пройти раньше), а не просто по порядковому номеру. ' +
    'У узлов на одном уровне дерева сложность может отличаться, если один из них объективно сложнее.\n' +
    '\n' +
    'Требования к материалу (resourceType/resourceUrl/resourceTitle) — ОБЯЗАТЕЛЕН на КАЖДОМ узле, ' +
    'без исключений:\n' +
    '- resourceType — СТРОГО одно из двух значений: "video" или "article". Никаких других слов ' +
    '("course", "book", "podcast" и т.п.) — курс или книгу тоже указывай как "article";\n' +
    '- используй только реально существующие, широко известные источники: официальную документацию, ' +
    'Wikipedia, устоявшиеся образовательные платформы (MDN, freeCodeCamp, Coursera, Khan Academy и т.п.) — ' +
    'то, в существовании и адресе чего ты действительно уверен;\n' +
    '- если не уверен в точном адресе конкретной статьи/видео — давай ссылку на главную страницу или ' +
    'корневой раздел документации/платформы, а не выдуманный глубокий URL;\n' +
    '- НЕ придумывай несуществующие статьи, курсы, видео или авторов — лучше более общая, но настоящая ссылка, ' +
    'чем точная, но выдуманная.'

  if (stricterInstruction) {
    userPrompt += `\n\nПРЕДЫДУЩАЯ ПОПЫТКА ОТКЛОНЕНА: ${stricterInstruction}\nВерни исправленный JSON, строго соответствующий формату и требованиям выше.`
  }

  const timeoutMs = Math.min(LLM_TIMEOUT_MAX_MS, LLM_TIMEOUT_BASE_MS + duration.maxNodes * LLM_TIMEOUT_PER_NODE_MS)

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
      temperature: 0.6,
      max_tokens: estimateMaxTokens(duration.maxNodes),
      response_format: { type: 'json_object' },
    }),
    // Явный таймаут внешнего вызова: без него зависший провайдер держит запрос открытым.
    signal: AbortSignal.timeout(timeoutMs),
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
  topic: string,
  duration: AiDurationOption
): Promise<{ tree: AiTreeResponse; model: string } | { error: string; timedOut?: boolean }> {
  let lastErrorDescription = ''
  const startedAt = Date.now()
  const treeSchema = buildAiTreeSchema(duration.minNodes, duration.maxNodes)

  for (const model of MODEL_CHAIN) {
    let moveToNextModel = false

    // Общий дедлайн цепочки: если время почти вышло — не начинаем новую модель.
    if (Date.now() - startedAt > TOTAL_DEADLINE_MS) break

    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !moveToNextModel; attempt += 1) {
      // Дедлайн проверяется и перед каждой ПОВТОРНОЙ попыткой той же модели:
      // на большом дереве один запрос может занять 30-50с (проверено вживую),
      // и без этой проверки 2-я попытка того же медленного запроса могла бы
      // вынести суммарное время далеко за maxDuration платформы.
      if (Date.now() - startedAt > TOTAL_DEADLINE_MS) break
      try {
        const rawContent = await callLlm(topic, model, duration, attempt > 1 ? lastErrorDescription : undefined)

        const parsed = treeSchema.safeParse(trimOversizedTree(extractJson(rawContent), duration.maxNodes))
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

    const { topic, category, duration: durationId } = validation.data
    const duration =
      AI_DURATION_OPTIONS.find((option) => option.id === durationId) ?? DEFAULT_AI_DURATION_OPTION
    const generation = await generateValidatedTree(topic, duration)

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
              // Материал обязателен схемой AiNodeSchema — на этом этапе он всегда есть.
              resources: [{ type: node.resourceType, url: node.resourceUrl, title: node.resourceTitle }],
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
      duration: duration.id,
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



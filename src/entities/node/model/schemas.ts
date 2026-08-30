import { z } from 'zod'
import type { Resource } from './types'

const resourceObjectSchema = z.object({
  type: z.enum(['video', 'article']),
  url: z.string().url(),
  title: z.string(),
})

export const ResourcesSchema = z.array(resourceObjectSchema)

/**
 * Ресурсы хранятся в Prisma как Json — приводим их к Resource[]
 * с рантайм-валидацией через zod. Невалидные значения дают пустой массив,
 * а при массиве с частью битых элементов — отбрасываются только они.
 */
export function parseResources(value: unknown): Resource[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const result = resourceObjectSchema.safeParse(item)
    return result.success ? [result.data] : []
  })
}

export const NodeSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000, 'Слишком длинное описание').optional(),
  positionX: z.number().min(-3000).max(3000),
  positionY: z.number().min(-3000).max(3000),
  difficulty: z.number().int().min(1).max(10),
  resourceType: z.enum(['video', 'article']).optional(),
  resourceUrl: z.string().url('Некорректный URL').optional(),
  resourceTitle: z.string().max(200).optional(),
  /** Явный сигнал «убрать ресурс с узла» — в PATCH пересобирает resources = []. */
  clearResource: z.boolean().optional(),
})

export const NodeCreateSchema = NodeSchema.partial().extend({
  // Создание требует название; лимиты держим теми же, что в базовой схеме.
  title: z.string().min(1, 'Название обязательно').max(200, 'Слишком длинное название'),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  difficulty: z.number().int().min(1).max(10).default(1),
})

export const NodeUpdateSchema = NodeSchema.partial()

export type NodeInput = z.infer<typeof NodeCreateSchema>
export type NodeUpdateInputZod = z.infer<typeof NodeUpdateSchema>

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
 * с рантайм-валидацией через zod. Невалидные значения дают пустой массив.
 */
export function parseResources(value: unknown): Resource[] {
  const result = ResourcesSchema.safeParse(value)
  return result.success ? result.data : []
}

export const NodeSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000, 'Слишком длинное описание').optional(),
  positionX: z.number().min(-1000).max(1000),
  positionY: z.number().min(-1000).max(1000),
  difficulty: z.number().min(1).max(10),
  resourceType: z.enum(['video', 'article']).optional(),
  resourceUrl: z.string().url('Некорректный URL').optional(),
  resourceTitle: z.string().max(200).optional(),
})

export const NodeCreateSchema = NodeSchema.partial().extend({
  title: z.string().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  difficulty: z.number().default(1),
})

export const NodeUpdateSchema = NodeSchema.partial()

export type NodeInput = z.infer<typeof NodeCreateSchema>
export type NodeUpdateInputZod = z.infer<typeof NodeUpdateSchema>

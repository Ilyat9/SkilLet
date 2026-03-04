import { z } from 'zod'

export const TreeSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000, 'Слишком длинное описание').optional(),
  isPublic: z.boolean().default(true),
})

export const TreeCreateSchema = TreeSchema.partial().extend({
  title: z.string().min(1),
})

export const TreeUpdateSchema = TreeSchema.partial().extend({
  title: z.string().min(1).optional(),
  description: z.string().max(1000).optional(),
  isPublic: z.boolean().optional(),
})

export type TreeInput = z.infer<typeof TreeCreateSchema>
export type TreeInputZod = z.infer<typeof TreeSchema>
export type TreeUpdateInput = z.infer<typeof TreeUpdateSchema>

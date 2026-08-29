import { z } from 'zod'
import { TREE_CATEGORIES, MAX_NODES_PER_TREE, MAX_EDGES_PER_TREE, NODE_POSITION_LIMIT } from '@/shared/constants'

/** Категория дерева — Prisma enum TreeCategory (список — в shared/constants). */
export const TreeCategorySchema = z.enum(TREE_CATEGORIES)

export const TreeSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000, 'Слишком длинное описание').optional(),
  category: TreeCategorySchema.default('OTHER'),
  isPublic: z.boolean().default(true),
})

export const TreeCreateSchema = TreeSchema.partial().extend({
  title: z.string().min(1),
})

export const TreeUpdateSchema = TreeSchema.partial().extend({
  title: z.string().min(1).optional(),
  description: z.string().max(1000).optional(),
  category: TreeCategorySchema.optional(),
  isPublic: z.boolean().optional(),
})

export type TreeInput = z.infer<typeof TreeCreateSchema>
export type TreeInputZod = z.infer<typeof TreeSchema>
export type TreeUpdateInput = z.infer<typeof TreeUpdateSchema>

/**
 * Портативный узел экспортированного дерева: без внутренних id, treeId и
 * authorId — только содержимое. Связи ссылаются на узлы по локальному индексу
 * массива nodes (тот же паттерн, что в prisma/seed.ts и шаблонах).
 */
export const ExportedNodeSchema = z.object({
  title: z.string().min(1, 'Название узла обязательно').max(200, 'Слишком длинное название узла'),
  description: z.string().max(1000, 'Слишком длинное описание узла').optional(),
  positionX: z.number().min(-NODE_POSITION_LIMIT).max(NODE_POSITION_LIMIT),
  positionY: z.number().min(-NODE_POSITION_LIMIT).max(NODE_POSITION_LIMIT),
  difficulty: z.number().int().min(1).max(10),
  resourceType: z.enum(['video', 'article']).optional(),
  resourceUrl: z.string().url('Некорректный URL ресурса').max(2048).optional(),
  resourceTitle: z.string().max(200).optional(),
})

export const ExportedConnectionSchema = z
  .tuple([z.number().int(), z.number().int()])
  .refine(([source, target]) => source !== target, { message: 'Связь узла с самим собой' })

/**
 * Формат экспорта SkilLet (.json). Поле format отличает файл нашего формата от
 * произвольного JSON, version — задел на будущие изменения формата.
 * isPublic не входит: импортирующий сам решает, делать ли дерево публичным.
 */
export const TreeExportSchema = z.object({
  format: z.literal('skillet-tree', { errorMap: () => ({ message: 'Ожидается файл формата SkilLet (format: "skillet-tree")' }) }),
  version: z.number().int().min(1).max(1),
  title: z.string().min(1, 'Название дерева обязательно').max(200, 'Слишком длинное название'),
  description: z.string().max(1000, 'Слишком длинное описание').optional(),
  category: TreeCategorySchema.default('OTHER'),
  nodes: z
    .array(ExportedNodeSchema)
    .min(1, 'Дерево должно содержать хотя бы один узел')
    .max(MAX_NODES_PER_TREE, `Слишком много узлов (максимум ${MAX_NODES_PER_TREE})`),
  connections: z
    .array(ExportedConnectionSchema)
    .max(MAX_EDGES_PER_TREE, `Слишком много связей (максимум ${MAX_EDGES_PER_TREE})`),
})

export type TreeExportInput = z.infer<typeof TreeExportSchema>

import { describe, it, expect } from 'vitest'
import {
  TreeExportSchema,
  TreeCreateSchema,
  TreeUpdateSchema,
} from './schemas'
import { sanitizeIndexConnections } from '@/shared/lib/dag'
import { MAX_NODES_PER_TREE } from '@/shared/constants'

describe('TreeExportSchema (валидация импорта дерева из файла)', () => {
  const validNode = {
    title: 'Узел',
    positionX: 0,
    positionY: 0,
    difficulty: 3,
  }

  const validTree = {
    format: 'skillet-tree' as const,
    version: 1,
    title: 'Дерево',
    category: 'FRONTEND',
    nodes: [validNode],
    connections: [],
  }

  it('принимает корректный portable-файл', () => {
    const result = TreeExportSchema.safeParse(validTree)
    expect(result.success).toBe(true)
  })

  it('отклоняет произвольный JSON без format: skillet-tree', () => {
    const result = TreeExportSchema.safeParse({
      title: 'Не SkilLet',
      nodes: [validNode],
      connections: [],
    })
    expect(result.success).toBe(false)
  })

  it('отклоняет пустой массив узлов', () => {
    const result = TreeExportSchema.safeParse({ ...validTree, nodes: [] })
    expect(result.success).toBe(false)
  })

  it('отклоняет слишком много узлов (защита от аномальных файлов)', () => {
    const nodes = Array.from({ length: MAX_NODES_PER_TREE + 1 }, () => validNode)
    const result = TreeExportSchema.safeParse({ ...validTree, nodes })
    expect(result.success).toBe(false)
  })

  it('отклоняет неизвестную категорию', () => {
    const result = TreeExportSchema.safeParse({ ...validTree, category: 'BLOCKCHAIN' })
    expect(result.success).toBe(false)
  })

  it('отклоняет URL-ресурс, не являющийся URL', () => {
    const result = TreeExportSchema.safeParse({
      ...validTree,
      nodes: [{ ...validNode, resourceType: 'video', resourceUrl: 'not-a-url', resourceTitle: 'x' }],
    })
    expect(result.success).toBe(false)
  })

  it('отклоняет координаты вне допустимых границ', () => {
    const result = TreeExportSchema.safeParse({
      ...validTree,
      nodes: [{ ...validNode, positionX: 99999 }],
    })
    expect(result.success).toBe(false)
  })

  it('отклоняет связь узла с самим собой', () => {
    const result = TreeExportSchema.safeParse({
      ...validTree,
      connections: [[2, 2]],
    })
    expect(result.success).toBe(false)
  })
})

describe('sanitizeIndexConnections (чистый инвариант DAG для индексов)', () => {
  it('отбрасывает связи с выходом за границы массива и самопетли', () => {
    const result = sanitizeIndexConnections(3, [
      [0, 1],
      [1, 1],
      [0, 5],
      [-1, 2],
    ])
    expect(result).toEqual([{ sourceIndex: 0, targetIndex: 1 }])
  })

  it('отбрасывает дубликаты и связи, создающие цикл', () => {
    const result = sanitizeIndexConnections(3, [
      [0, 1],
      [1, 2],
      [2, 0], // цикл
      [0, 1], // дубликат
    ])
    expect(result).toEqual([
      { sourceIndex: 0, targetIndex: 1 },
      { sourceIndex: 1, targetIndex: 2 },
    ])
  })
})

describe('Tree-схемы: категория', () => {
  it('TreeCreateSchema принимает категорию из enum', () => {
    const result = TreeCreateSchema.safeParse({ title: 'T', category: 'BACKEND' })
    expect(result.success).toBe(true)
    expect(result.success && result.data.category).toBe('BACKEND')
  })

  it('TreeUpdateSchema отклоняет неизвестную категорию', () => {
    const result = TreeUpdateSchema.safeParse({ category: 'NOPE' })
    expect(result.success).toBe(false)
  })
})
import { Node, Edge as PrismaEdge } from '@prisma/client'
import type { TreeCategoryValue } from '@/shared/constants'

/** Агрегат сложности дерева (считается на сервере для листинга каталога). */
export interface TreeDifficultyStats {
  avg: number
  min: number
  max: number
}

export interface Tree {
  id: string
  title: string
  description: string | null
  category: TreeCategoryValue
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  authorId: string
  /** Форк: id дерева-оригинала (null — не форк). */
  forkedFromId: string | null
  _count?: {
    nodes: number
    /** Завершённые UserProgress — метрика активности изучения (GET /api/trees). */
    progresses?: number | undefined
    edges?: number | undefined
    /** Лайки сообщества — метрика популярности каталога. */
    likes?: number | undefined
  }
  /** Поставил ли текущий пользователь лайк (заполняется GET /api/trees при авторизации). */
  likedByMe?: boolean | undefined
  /** Статистика сложности узлов (заполняется GET /api/trees?scope=public). */
  difficultyStats?: TreeDifficultyStats | undefined
  author?: {
    id: string
    name: string | null
    image: string | null
  }
  /** Атрибуция форка: оригинал с автором (заполняется GET /api/trees/[id]). */
  forkedFrom?: {
    id: string
    title: string
    author: { id: string; name: string | null }
  } | null
}

export interface TreeWithRelations extends Tree {
  nodes: Node[]
  edges: PrismaEdge[]
}

export interface TreeCreateInput {
  title: string
  description?: string
  category?: TreeCategoryValue
  isPublic?: boolean
}


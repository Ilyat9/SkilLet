import { Node, Edge as PrismaEdge } from '@prisma/client'
import { z } from 'zod'

export interface Tree {
  id: string
  title: string
  description: string | null
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  authorId: string
  _count?: {
    nodes: number
  }
  author?: {
    id: string
    name: string | null
    image: string | null
  }
}

export interface TreeWithRelations extends Tree {
  nodes: Node[]
  edges: PrismaEdge[]
}

export interface TreeCreateInput {
  title: string
  description?: string
  isPublic?: boolean
}

export interface TreeUpdateInput {
  title?: string
  description?: string
  isPublic?: boolean
}

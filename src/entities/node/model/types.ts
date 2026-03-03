import { Node as PrismaNode, Edge as PrismaEdge } from '@prisma/client'
import { z } from 'zod'

export interface Node {
  id: string
  title: string
  description: string | null
  resources: Resource[]
  positionX: number
  positionY: number
  difficulty: number
  treeId: string
  tree?: {
    id: string
    title: string
  }
  outgoingEdges?: PrismaEdge[]
  incomingEdges?: PrismaEdge[]
}

export interface Resource {
  type: 'video' | 'article'
  url: string
  title: string
}

export interface NodeCreateInput {
  title: string
  description?: string
  positionX: number
  positionY: number
  difficulty: number
  resourceType?: 'video' | 'article'
  resourceUrl?: string
  resourceTitle?: string
}

export interface NodeUpdateInput {
  title?: string
  description?: string
  positionX?: number
  positionY?: number
  difficulty?: number
}

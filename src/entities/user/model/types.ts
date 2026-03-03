import { User } from '@prisma/client'

export interface UserWithRelations extends User {
  trees?: {
    id: string
    title: string
    isPublic: boolean
    createdAt: Date
    author: {
      id: string
      name: string | null
      image: string | null
    }
  }[]
}

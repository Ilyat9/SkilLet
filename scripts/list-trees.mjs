import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const trees = await p.tree.findMany({ select: { id: true, title: true, createdAt: true }, orderBy: { createdAt: 'desc' } })
console.log(trees.map((t) => `${t.id} | ${t.title} | ${t.createdAt.toISOString()}`).join('\n'))
await p.$disconnect()

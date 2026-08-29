import { PrismaClient } from '@prisma/client'

/** Разовая очистка smoke-данных. */
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'smoke@skillet.dev' } })
  if (user) {
    await prisma.treeLike.deleteMany({ where: { userId: user.id } })
    await prisma.comment.deleteMany({ where: { authorId: user.id } })
    await prisma.tree.deleteMany({ where: { authorId: user.id } })
    await prisma.user.delete({ where: { id: user.id } })
  }
  console.log('smoke-данные удалены')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
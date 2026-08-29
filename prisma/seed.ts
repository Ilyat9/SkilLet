import { PrismaClient } from '@prisma/client'
import { ACHIEVEMENT_DEFS } from '../src/shared/lib/gamification'

const prisma = new PrismaClient()

type NodeData = {
  title: string
  description?: string
  positionX: number
  positionY: number
  difficulty: number
  resourceType?: 'video' | 'article'
  resourceUrl?: string
  resourceTitle?: string
}

type EdgePair = [sourceIndex: number, targetIndex: number]

type TreeSeed = {
  key: string
  title: string
  description: string
  isPublic: boolean
  category: 'FRONTEND' | 'BACKEND' | 'DEVOPS' | 'DATA_SCIENCE' | 'SOFT_SKILLS' | 'DESIGN' | 'OTHER'
  nodes: NodeData[]
  /** Пары индексов [sourceIndex, targetIndex] по массиву nodes. */
  connections: EdgePair[]
}

/**
 * Строит данные узлов с детерминированными id. Связи строятся
 * по индексам массива узлов, а не по хардкоду строковых id.
 */
function buildNodesData(treeKey: string, nodeDefs: NodeData[]) {
  return nodeDefs.map((def, index) => {
    const resources =
      def.resourceType && def.resourceUrl && def.resourceTitle
        ? [{ type: def.resourceType, url: def.resourceUrl, title: def.resourceTitle }]
        : []

    return {
      id: `seed-${treeKey}-node-${index}`,
      title: def.title,
      description: def.description ?? null,
      positionX: def.positionX,
      positionY: def.positionY,
      difficulty: def.difficulty,
      resources,
    }
  })
}

const frontendTree: TreeSeed = {
  key: 'frontend',
  title: 'Frontend Разработчик',
  description: 'Полный путь от основ до продакшена',
  isPublic: true,
  category: 'FRONTEND',
  nodes: [
    { title: 'Начало', description: 'Добро пожаловать в ваш первый навык', positionX: 0, positionY: -150, difficulty: 1 },
    { title: 'HTML & CSS Базовый', positionX: 0, positionY: -50, difficulty: 1, resourceType: 'article', resourceUrl: 'https://developer.mozilla.org/ru/docs/Web/HTML', resourceTitle: 'MDN: HTML' },
    { title: 'Вёрстка с Flexbox', positionX: 100, positionY: -50, difficulty: 2, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=zw8dLx1D9Uw', resourceTitle: 'Flexbox Froggy' },
    { title: 'Вёрстка с Grid', positionX: 200, positionY: -50, difficulty: 2, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=QAxZxOJ09-Y', resourceTitle: 'Grid Masterclass' },
    { title: 'TypeScript Основы', positionX: 100, positionY: 50, difficulty: 3, resourceType: 'article', resourceUrl: 'https://www.typescriptlang.org/docs/', resourceTitle: 'TypeScript Docs' },
    { title: 'Компоненты React', positionX: 200, positionY: 50, difficulty: 3, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=kse4gB3VQj8', resourceTitle: 'React Components' },
    { title: 'Hooks useState', positionX: 300, positionY: 50, difficulty: 3, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=wpCEBS_-kHo', resourceTitle: 'React Hooks' },
    { title: 'Hooks useEffect', positionX: 400, positionY: 50, difficulty: 4, resourceType: 'article', resourceUrl: 'https://react.dev/reference/react/useEffect', resourceTitle: 'React useEffect' },
    { title: 'Управление состоянием', positionX: 300, positionY: 150, difficulty: 4, resourceType: 'article', resourceUrl: 'https://react.dev/learn/managing-state', resourceTitle: 'React State Guide' },
    { title: 'Прокидывание пропсов', positionX: 400, positionY: 150, difficulty: 4, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=8aiPr2H_NGY', resourceTitle: 'Props in React' },
    { title: 'Formik или React Hook Form', positionX: 500, positionY: 150, difficulty: 5, resourceType: 'article', resourceUrl: 'https://react-hook-form.com/', resourceTitle: 'React Hook Form' },
    { title: 'Next.js 15 Основы', positionX: 400, positionY: 250, difficulty: 5, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=5j_hx9eC-yg', resourceTitle: 'Next.js 15 Tutorial' },
    { title: 'API Routes', positionX: 500, positionY: 250, difficulty: 6, resourceType: 'article', resourceUrl: 'https://nextjs.org/docs/api-routes/introduction', resourceTitle: 'Next.js API Routes' },
    { title: 'Базовый Routing', positionX: 600, positionY: 250, difficulty: 6, resourceType: 'article', resourceUrl: 'https://nextjs.org/docs/routing/introduction', resourceTitle: 'Next.js Routing' },
    { title: 'Tailwind CSS', positionX: 700, positionY: 250, difficulty: 2, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=Q8xrEgnh77I', resourceTitle: 'Tailwind CSS Basics' },
    { title: 'CI/CD Pipeline', positionX: 600, positionY: 350, difficulty: 7, resourceType: 'article', resourceUrl: 'https://vercel.com/docs/concepts/deployments/overview', resourceTitle: 'Vercel Deployment' },
    // В исходном литерале был дублирующийся positionY — оставлено одно корректное значение (450).
    { title: 'Заключение', positionX: 700, positionY: 450, description: 'Вы изучили основы Frontend разработки!', difficulty: 10, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=6B8vcbsJIsM', resourceTitle: 'Frontend Roadmap' },
  ],
  connections: [
    [0, 1], [0, 4], [0, 16],
    [1, 3], [3, 5],
    [4, 3], [4, 5], [4, 7], [4, 10], [4, 14],
    [5, 6], [6, 7], [7, 8], [8, 9], [9, 10],
    [10, 12], [10, 14], [11, 12], [12, 13], [13, 14], [14, 16],
  ],
}

const softSkillsTree: TreeSeed = {
  key: 'softskills',
  title: 'Soft Skills',
  description: 'Навыки для эффективной работы в команде',
  isPublic: true,
  category: 'SOFT_SKILLS',
  nodes: [
    { title: 'Знакомство', positionX: 0, positionY: -150, difficulty: 1 },
    { title: 'Командная работа', positionX: 0, positionY: -50, difficulty: 1 },
    { title: 'Git базовый', positionX: 100, positionY: -50, difficulty: 2 },
    { title: 'Коммуникация', positionX: 0, positionY: 50, difficulty: 2 },
    { title: 'CI/CD', positionX: 200, positionY: -50, difficulty: 3 },
    { title: 'Code Review', positionX: 100, positionY: 50, difficulty: 3 },
    { title: 'Обратная связь', positionX: 100, positionY: 150, difficulty: 2 },
    { title: 'Code Quality', positionX: 200, positionY: 50, difficulty: 4 },
    { title: 'Дедлайны', positionX: 100, positionY: 250, difficulty: 3 },
    { title: 'Team Lead', positionX: 100, positionY: 350, difficulty: 10 },
  ],
  connections: [
    [0, 1], [1, 2], [1, 3],
    [2, 4], [2, 5], [3, 6],
    [4, 7], [5, 7], [6, 8], [7, 9], [8, 9],
  ],
}

async function main() {
  console.log('🌱 Начало seed...')

  // Каталог достижений — upsert по коду, чтобы повторные прогоны не ломались.
  let achievementsSynced = 0
  for (const def of ACHIEVEMENT_DEFS) {
    await prisma.achievement.upsert({
      where: { code: def.code },
      update: { title: def.title, description: def.description, icon: def.icon },
      create: { code: def.code, title: def.title, description: def.description, icon: def.icon },
    })
    achievementsSynced += 1
  }
  console.log(`🏆 Достижения синхронизированы: ${achievementsSynced}`)

  const author = await prisma.user.upsert({
    where: { email: 'demo@skillet.dev' },
    update: {},
    create: {
      email: 'demo@skillet.dev',
      name: 'Demo User',
      githubId: 'demo-github-id',
    },
  })

  console.log('👤 Создан пользователь:', author.name)

  // Идемпотентность повторных прогонов: пересоздаём только сидируемые деревья
  // демо-автора. Пользовательские данные (другие авторы) не затрагиваются.
  const deletedStale = await prisma.tree.deleteMany({
    where: { authorId: author.id },
  })
  if (deletedStale.count > 0) {
    console.log(`🧹 Удалены устаревшие сидируемые деревья: ${deletedStale.count}`)
  }

  const treesToSeed = [frontendTree, softSkillsTree]

  let totalNodesCreated = 0
  let totalEdgesCreated = 0

  for (const treeSeed of treesToSeed) {
    const nodesData = buildNodesData(treeSeed.key, treeSeed.nodes)

    await prisma.$transaction(async (tx) => {
      console.log(`🌳 Создание дерева «${treeSeed.title}»...`)

      // Вложенный create: Prisma сам подставит treeId для узлов.
      const tree = await tx.tree.create({
        data: {
          title: treeSeed.title,
          description: treeSeed.description,
          isPublic: treeSeed.isPublic,
          category: treeSeed.category,
          authorId: author.id,
          nodes: { create: nodesData },
        },
        include: { nodes: true },
      })

      // Маппинг индекс → реальный id из БД.
      const idByIndex = new Map<number, string>()
      for (let index = 0; index < nodesData.length; index += 1) {
        const createdNode = tree.nodes.find((n) => n.id === nodesData[index]?.id)
        if (!createdNode) {
          throw new Error(`Узел с id ${nodesData[index]?.id} не найден после создания дерева`)
        }
        idByIndex.set(index, createdNode.id)
      }

      const edgesData = treeSeed.connections
        .map(([sourceIndex, targetIndex]) => {
          const sourceId = idByIndex.get(sourceIndex)
          const targetId = idByIndex.get(targetIndex)
          if (!sourceId || !targetId) {
            throw new Error(
              `Связь [${sourceIndex}, ${targetIndex}] ссылается на несуществующий узел дерева «${treeSeed.title}»`
            )
          }
          return { treeId: tree.id, sourceId, targetId }
        })

      if (edgesData.length > 0) {
        await tx.edge.createMany({ data: edgesData })
      }

      // Прогресс по первому узлу frontend-дерева.
      if (treeSeed.key === 'frontend') {
        const firstNodeId = idByIndex.get(0)
        if (!firstNodeId) {
          throw new Error('Первый узел frontend-дерева не найден — невозможно создать прогресс')
        }
        await tx.userProgress.create({
          data: {
            userId: author.id,
            treeId: tree.id,
            nodeId: firstNodeId,
            completed: true,
            completedAt: new Date(),
          },
        })
        console.log('🎯 Создан начальный прогресс для первого узла')
      }

      totalNodesCreated += tree.nodes.length
      totalEdgesCreated += edgesData.length

      console.log(
        `✅ «${tree.title}»: узлов=${tree.nodes.length}, связей=${edgesData.length}`
      )
    })
  }

  // Публичное пустое дерево-пример.
  await prisma.tree.create({
    data: {
      title: 'Мои навыки',
      description: 'Ваши деревья навыков появятся здесь',
      isPublic: false,
      authorId: author.id,
    },
  })

  // Финальная верификация.
  const [nodeCount, edgeCount, achievementTotal, userAchievementTotal] = await Promise.all([
    prisma.node.count(),
    prisma.edge.count(),
    prisma.achievement.count(),
    prisma.userAchievement.count(),
  ])

  console.log('🎉 Seed завершён успешно!')
  console.log(`📊 Всего в БД: узлов=${nodeCount}, рёбер=${edgeCount}`)
  console.log(`📊 Создано за прогон: узлов=${totalNodesCreated}, рёбер=${totalEdgesCreated}`)
  console.log(`📊 Достижений в каталоге=${achievementTotal}, выдано пользователям=${userAchievementTotal}`)
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

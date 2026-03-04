import 'server-only'
import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const prisma = new PrismaClient()

type TreeData = {
  title: string
  description: string
  isPublic: boolean
  authorId: string
  nodes: NodeData[]
}

type NodeData = {
  title: string
  description?: string
  positionX: number
  positionY: number
  difficulty: number
  resourceType?: string
  resourceUrl?: string
  resourceTitle?: string
}

function generateNodes(treeId: string, authorId: string): Prisma.Node[] {
  const nodes: PrismaNode[] = []
  let nodeIdCounter = 0

  const createNode = (data: NodeData): PrismaNode => {
    const node = {
      id: `node-${treeId}-${nodeIdCounter++}`,
      title: data.title,
      description: data.description,
      resources: data.resourceType ? [{ type: data.resourceType, url: data.resourceUrl!, title: data.resourceTitle! }] : [],
      positionX: data.positionX,
      positionY: data.positionY,
      difficulty: data.difficulty,
      treeId,
    }
    nodes.push(node)
    return node
  }

  // Начальный узел
  const startNode = createNode({
    title: 'Начало',
    description: 'Добро пожаловать в ваш первый навык',
    positionX: 0,
    positionY: -150,
    difficulty: 1,
  })

  // Основной путь: 16 узлов для Frontend разработчика
  const frontendPath = [
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
    { title: 'Заключение', positionX: 700, positionY: 350, description: 'Вы изучили основы Frontend разработки!', positionY: 450, difficulty: 10, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=6B8vcbsJIsM', resourceTitle: 'Frontend Roadmap' },
  ]

  const skillPath = [
    { title: 'Командная работа', positionX: 0, positionY: 0, difficulty: 1 },
    { title: 'Git базовый', positionX: 100, positionY: 0, difficulty: 2 },
    { title: 'CI/CD', positionX: 200, positionY: 0, difficulty: 3 },
    { title: 'Code Review', positionX: 100, positionY: 100, difficulty: 3 },
    { title: 'Code Quality', positionX: 200, positionY: 100, difficulty: 4 },
  ]

  const collaborationPath = [
    { title: 'Знакомство', positionX: 0, positionY: -150, difficulty: 1 },
    { title: 'Коммуникация', positionX: 0, positionY: -50, difficulty: 2 },
    { title: 'Обратная связь', positionX: 100, positionY: -50, difficulty: 2 },
    { title: 'Дедлайны', positionX: 100, positionY: 50, difficulty: 3 },
    { title: 'Team Lead', positionX: 100, positionY: 150, difficulty: 10 },
  ]

  frontendPath.forEach((nodeData) => createNode(nodeData))
  skillPath.forEach((nodeData) => createNode(nodeData))
  collaborationPath.forEach((nodeData) => createNode(nodeData))

  return nodes
}

function generateEdges(treeId: string, nodes: PrismaNode[]): PrismaEdge[] {
  const edges: PrismaEdge[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  const createEdge = (sourceId: string, targetId: string) => {
    edges.push({
      id: `edge-${sourceId}-${targetId}`,
      treeId,
      sourceId,
      targetId,
    })
  }

  const connections: Record<string, string[]> = {
    'node-skillet-start-0': [
      'node-skillet-start-1',
      'node-skillet-start-4',
      'node-skillet-start-16',
    ],
    'node-skillet-start-1': ['node-skillet-start-3'],
    'node-skillet-start-3': ['node-skillet-start-5'],
    'node-skillet-start-4': ['node-skillet-start-7', 'node-skillet-start-10'],
    'node-skillet-start-5': ['node-skillet-start-6'],
    'node-skillet-start-6': ['node-skillet-start-7'],
    'node-skillet-start-7': ['node-skillet-start-8', 'node-skillet-start-11'],
    'node-skillet-start-8': ['node-skillet-start-9'],
    'node-skillet-start-9': ['node-skillet-start-10'],
    'node-skillet-start-10': ['node-skillet-start-12', 'node-skillet-start-14'],
    'node-skillet-start-11': ['node-skillet-start-12'],
    'node-skillet-start-12': ['node-skillet-start-13'],
    'node-skillet-start-13': ['node-skillet-start-14'],
    'node-skillet-start-14': ['node-skillet-start-16'],
    'node-skillet-start-16': ['node-skillet-start-17'],
    'node-skillet-start-4': ['node-skillet-start-3', 'node-skillet-start-5', 'node-skillet-start-10', 'node-skillet-start-14'],
  }

  Object.entries(connections).forEach(([sourceId, targets]) => {
    targets.forEach((targetId) => {
      if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
        createEdge(sourceId, targetId)
      }
    })
  })

  return edges
}

async function main() {
  console.log('🌱 Начало seed...')

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

  const frontendTree = {
    title: 'Frontend Разработчик',
    description: 'Полный путь от основ до продакшена',
    isPublic: true,
    authorId: author.id,
    nodes: generateNodes(`skillet-${author.id}-frontend`, author.id),
  }

  const collaborationTree = {
    title: 'Soft Skills',
    description: 'Навыки для эффективной работы в команде',
    isPublic: true,
    authorId: author.id,
    nodes: generateNodes(`skillet-${author.id}-softskills`, author.id),
  }

  const myTree = {
    title: 'Мои навыки',
    description: 'Ваши деревья навыков появятся здесь',
    isPublic: false,
    authorId: author.id,
    nodes: [],
  }

  await prisma.$transaction(async (tx) => {
    console.log('🌳 Создание деревьев...')

    const frontend = await tx.tree.create({
      data: frontendTree,
    })

    const collaboration = await tx.tree.create({
      data: collaborationTree,
    })

    const my = await tx.tree.create({
      data: myTree,
    })

    console.log('✅ Созданы деревья:', frontend.title, collaboration.title, my.title)

    console.log('🔗 Создание связей...')

    const frontendNodes = await tx.node.findMany({ where: { treeId: frontend.id } })
    const frontendEdges = generateEdges(frontend.id, frontendNodes)

    const collaborationNodes = await tx.node.findMany({ where: { treeId: collaboration.id } })
    const collaborationEdges = generateEdges(collaboration.id, collaborationNodes)

    await tx.edge.createMany({ data: frontendEdges })
    await tx.edge.createMany({ data: collaborationEdges })

    console.log('✅ Созданы связи:', frontendEdges.length, 'для', frontend.title, collaborationEdges.length, 'для', collaboration.title)

    console.log('🎯 Создание прогресса для первого дерева...')
    const firstNode = frontendNodes[0]
    await tx.userProgress.create({
      data: {
        userId: author.id,
        treeId: frontend.id,
        nodeId: firstNode.id,
        completed: true,
        completedAt: new Date(),
      },
    })

    console.log('✅ Создан начальный прогресс для', frontend.title)
  })

  console.log('🎉 Seed завершён успешно!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

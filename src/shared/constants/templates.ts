import type { TreeCategoryValue } from '@/shared/constants'

export interface TemplateNodeData {
  title: string
  description?: string
  positionX: number
  positionY: number
  difficulty: number
  resourceType?: 'video' | 'article'
  resourceUrl?: string
  resourceTitle?: string
}

export interface SkillTemplate {
  id: string
  title: string
  description: string
  /** Категория, с которой создаётся дерево из шаблона. */
  category: TreeCategoryValue
  nodes: TemplateNodeData[]
  /** Пары индексов [sourceIndex, targetIndex] по массиву nodes. */
  connections: Array<readonly [number, number]>
}

// Шаг сетки шаблонов: карточка узла — 224px шириной (w-56) и ~150px высотой,
// поэтому шаг меньше 280×220 даёт наложение карточек друг на друга.
const GRID_X = 280
const GRID_Y = 220

const frontendNodes: TemplateNodeData[] = [
  { title: 'Начало', description: 'Добро пожаловать в ваш первый навык', positionX: 0, positionY: -GRID_Y, difficulty: 1 },
  { title: 'HTML & CSS Базовый', positionX: GRID_X, positionY: -GRID_Y, difficulty: 1, resourceType: 'article', resourceUrl: 'https://developer.mozilla.org/ru/docs/Web/HTML', resourceTitle: 'MDN: HTML' },
  { title: 'Вёрстка с Flexbox', positionX: 2 * GRID_X, positionY: -GRID_Y, difficulty: 2, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=zw8dLx1D9Uw', resourceTitle: 'Flexbox Froggy' },
  { title: 'Вёрстка с Grid', positionX: 3 * GRID_X, positionY: -GRID_Y, difficulty: 2, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=QAxZxOJ09-Y', resourceTitle: 'Grid Masterclass' },
  { title: 'TypeScript Основы', positionX: GRID_X, positionY: 0, difficulty: 3, resourceType: 'article', resourceUrl: 'https://www.typescriptlang.org/docs/', resourceTitle: 'TypeScript Docs' },
  { title: 'Компоненты React', positionX: 2 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=kse4gB3VQj8', resourceTitle: 'React Components' },
  { title: 'Hooks useState', positionX: 3 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=wpCEBS_-kHo', resourceTitle: 'React Hooks' },
  { title: 'Hooks useEffect', positionX: 4 * GRID_X, positionY: 0, difficulty: 4, resourceType: 'article', resourceUrl: 'https://react.dev/reference/react/useEffect', resourceTitle: 'React useEffect' },
  { title: 'Управление состоянием', positionX: 3 * GRID_X, positionY: GRID_Y, difficulty: 4, resourceType: 'article', resourceUrl: 'https://react.dev/learn/managing-state', resourceTitle: 'React State Guide' },
  { title: 'Прокидывание пропсов', positionX: 4 * GRID_X, positionY: GRID_Y, difficulty: 4, resourceType: 'video', resourceUrl: 'https://www.youtube.com/watch?v=8aiPr2H_NGY', resourceTitle: 'Props in React' },
]

const frontendConnections: Array<readonly [number, number]> = [
  [0, 1], [0, 4],
  [1, 2], [2, 3],
  [1, 4], [4, 5],
  [5, 6], [6, 7],
  [5, 8], [8, 9],
]

const backendNodes: TemplateNodeData[] = [
  { title: 'Начало', description: 'Путь Backend разработчика', positionX: 0, positionY: 0, difficulty: 1 },
  { title: 'Node.js Основы', positionX: GRID_X, positionY: 0, difficulty: 2, resourceType: 'article', resourceUrl: 'https://nodejs.org/docs/latest/api/', resourceTitle: 'Node.js Docs' },
  { title: 'REST API', positionX: 2 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'article', resourceUrl: 'https://restfulapi.net/', resourceTitle: 'RESTful API' },
  { title: 'PostgreSQL', positionX: 3 * GRID_X, positionY: 0, difficulty: 4, resourceType: 'article', resourceUrl: 'https://www.postgresql.org/docs/', resourceTitle: 'PostgreSQL Docs' },
  { title: 'Аутентификация', positionX: 4 * GRID_X, positionY: 0, difficulty: 5 },
  { title: 'Деплой и CI/CD', positionX: 5 * GRID_X, positionY: 0, difficulty: 6, resourceType: 'article', resourceUrl: 'https://vercel.com/docs/concepts/deployments/overview', resourceTitle: 'Vercel Deployment' },
]

const backendConnections: Array<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
]

const dataScienceNodes: TemplateNodeData[] = [
  { title: 'Начало', description: 'Путь Data Scientist', positionX: 0, positionY: 0, difficulty: 1 },
  { title: 'Python Основы', positionX: GRID_X, positionY: 0, difficulty: 2, resourceType: 'article', resourceUrl: 'https://docs.python.org/3/tutorial/', resourceTitle: 'Python Tutorial' },
  { title: 'NumPy', positionX: 2 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'article', resourceUrl: 'https://numpy.org/doc/', resourceTitle: 'NumPy Docs' },
  { title: 'Pandas', positionX: 3 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'article', resourceUrl: 'https://pandas.pydata.org/docs/', resourceTitle: 'Pandas Docs' },
  { title: 'Scikit-learn', positionX: 4 * GRID_X, positionY: 0, difficulty: 5, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/user_guide.html', resourceTitle: 'Sklearn Guide' },
  { title: 'Модель в продакшене', positionX: 5 * GRID_X, positionY: 0, difficulty: 7 },
]

const dataScienceConnections: Array<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
]

export const TEMPLATES: SkillTemplate[] = [
  {
    id: 'frontend',
    title: 'Frontend Разработчик',
    description: 'HTML, CSS, JavaScript, React, Next.js, TypeScript',
    category: 'FRONTEND',
    nodes: frontendNodes,
    connections: frontendConnections,
  },
  {
    id: 'backend',
    title: 'Backend Разработчик',
    description: 'Node.js, PostgreSQL, REST API',
    category: 'BACKEND',
    nodes: backendNodes,
    connections: backendConnections,
  },
  {
    id: 'data-science',
    title: 'Data Scientist',
    description: 'Python, NumPy, Pandas, Scikit-learn',
    category: 'DATA_SCIENCE',
    nodes: dataScienceNodes,
    connections: dataScienceConnections,
  },
]

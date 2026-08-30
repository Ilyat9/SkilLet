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
  { title: 'Валидация и DTO', positionX: 3 * GRID_X, positionY: -GRID_Y, difficulty: 3, resourceType: 'article', resourceUrl: 'https://zod.dev/', resourceTitle: 'Zod Docs' },
  { title: 'PostgreSQL', positionX: 3 * GRID_X, positionY: GRID_Y, difficulty: 4, resourceType: 'article', resourceUrl: 'https://www.postgresql.org/docs/', resourceTitle: 'PostgreSQL Docs' },
  { title: 'ORM (Prisma)', positionX: 4 * GRID_X, positionY: GRID_Y, difficulty: 4, resourceType: 'article', resourceUrl: 'https://www.prisma.io/docs', resourceTitle: 'Prisma Docs' },
  { title: 'Аутентификация', positionX: 5 * GRID_X, positionY: 0, difficulty: 5, resourceType: 'article', resourceUrl: 'https://authjs.dev/', resourceTitle: 'Auth.js Docs' },
  { title: 'Кэширование (Redis)', positionX: 5 * GRID_X, positionY: 2 * GRID_Y, difficulty: 5, resourceType: 'article', resourceUrl: 'https://redis.io/docs/latest/', resourceTitle: 'Redis Docs' },
  { title: 'Тестирование API', positionX: 6 * GRID_X, positionY: 0, difficulty: 5, resourceType: 'article', resourceUrl: 'https://vitest.dev/', resourceTitle: 'Vitest Docs' },
  { title: 'Очереди и фоновые задачи', positionX: 6 * GRID_X, positionY: 2 * GRID_Y, difficulty: 6, resourceType: 'article', resourceUrl: 'https://docs.bullmq.io/', resourceTitle: 'BullMQ Docs' },
  { title: 'Docker', positionX: 7 * GRID_X, positionY: GRID_Y, difficulty: 6, resourceType: 'article', resourceUrl: 'https://docs.docker.com/get-started/', resourceTitle: 'Docker Docs' },
  { title: 'Деплой и CI/CD', positionX: 8 * GRID_X, positionY: GRID_Y, difficulty: 7, resourceType: 'article', resourceUrl: 'https://vercel.com/docs/concepts/deployments/overview', resourceTitle: 'Vercel Deployment' },
]

const backendConnections: Array<readonly [number, number]> = [
  [0, 1], [1, 2],
  [2, 3], [2, 4],
  [4, 5],
  [3, 6], [5, 6], [5, 7],
  [6, 8], [7, 9],
  [8, 10], [9, 10],
  [10, 11],
]

const mlNodes: TemplateNodeData[] = [
  { title: 'Начало', description: 'Путь в Data Science и Machine Learning', positionX: 0, positionY: 0, difficulty: 1 },
  { title: 'Python Основы', positionX: GRID_X, positionY: 0, difficulty: 1, resourceType: 'article', resourceUrl: 'https://docs.python.org/3/tutorial/', resourceTitle: 'Python Tutorial' },
  { title: 'NumPy', positionX: 2 * GRID_X, positionY: -GRID_Y, difficulty: 2, resourceType: 'article', resourceUrl: 'https://numpy.org/doc/stable/user/quickstart.html', resourceTitle: 'NumPy Quickstart' },
  { title: 'Pandas', positionX: 2 * GRID_X, positionY: GRID_Y, difficulty: 2, resourceType: 'article', resourceUrl: 'https://pandas.pydata.org/docs/getting_started/index.html', resourceTitle: 'Pandas Getting Started' },
  { title: 'Статистика и вероятность', positionX: 2 * GRID_X, positionY: 2 * GRID_Y, difficulty: 2, resourceType: 'article', resourceUrl: 'https://www.khanacademy.org/math/statistics-probability', resourceTitle: 'Khan Academy: Statistics & Probability' },
  { title: 'Визуализация данных', positionX: 3 * GRID_X, positionY: 0, difficulty: 3, resourceType: 'article', resourceUrl: 'https://matplotlib.org/stable/tutorials/index.html', resourceTitle: 'Matplotlib Tutorials' },
  { title: 'Разведочный анализ данных (EDA)', positionX: 4 * GRID_X, positionY: 0, difficulty: 4, resourceType: 'article', resourceUrl: 'https://www.ibm.com/topics/exploratory-data-analysis', resourceTitle: 'IBM: What is EDA' },
  { title: 'Feature Engineering', positionX: 5 * GRID_X, positionY: 0, difficulty: 5, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/modules/preprocessing.html', resourceTitle: 'Scikit-learn: Preprocessing' },
  { title: 'Scikit-learn: регрессия', positionX: 6 * GRID_X, positionY: -GRID_Y, difficulty: 5, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/modules/linear_model.html', resourceTitle: 'Scikit-learn: Linear Models' },
  { title: 'Scikit-learn: классификация', positionX: 6 * GRID_X, positionY: 0, difficulty: 5, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/supervised_learning.html', resourceTitle: 'Scikit-learn: Supervised Learning' },
  { title: 'Кластеризация', positionX: 6 * GRID_X, positionY: GRID_Y, difficulty: 5, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/modules/clustering.html', resourceTitle: 'Scikit-learn: Clustering' },
  { title: 'Оценка моделей и кросс-валидация', positionX: 7 * GRID_X, positionY: -GRID_Y, difficulty: 6, resourceType: 'article', resourceUrl: 'https://scikit-learn.org/stable/modules/model_evaluation.html', resourceTitle: 'Scikit-learn: Model Evaluation' },
  { title: 'Введение в нейросети (PyTorch)', positionX: 8 * GRID_X, positionY: -GRID_Y, difficulty: 7, resourceType: 'article', resourceUrl: 'https://pytorch.org/tutorials/beginner/basics/intro.html', resourceTitle: 'PyTorch: Learn the Basics' },
  { title: 'Модель в продакшене', positionX: 9 * GRID_X, positionY: -GRID_Y, difficulty: 8, resourceType: 'article', resourceUrl: 'https://mlflow.org/docs/latest/index.html', resourceTitle: 'MLflow Docs' },
]

const mlConnections: Array<readonly [number, number]> = [
  [0, 1],
  [1, 2], [1, 3], [1, 4],
  [2, 5], [3, 5],
  [5, 6], [4, 6],
  [6, 7],
  [7, 8], [7, 9], [7, 10],
  [8, 11], [9, 11],
  [11, 12],
  [12, 13],
]

const languageNodes: TemplateNodeData[] = [
  { title: 'Начало', description: 'Путь изучения иностранного языка с нуля', positionX: 0, positionY: 0, difficulty: 1 },
  { title: 'Алфавит и произношение', positionX: GRID_X, positionY: 0, difficulty: 1, resourceType: 'article', resourceUrl: 'https://forvo.com/', resourceTitle: 'Forvo — произношение слов' },
  { title: 'Базовые фразы и приветствия', positionX: 2 * GRID_X, positionY: -GRID_Y, difficulty: 2, resourceType: 'article', resourceUrl: 'https://www.duolingo.com/', resourceTitle: 'Duolingo' },
  { title: 'Основная грамматика', positionX: 2 * GRID_X, positionY: GRID_Y, difficulty: 2, resourceType: 'article', resourceUrl: 'https://en.wikipedia.org/wiki/Grammar', resourceTitle: 'Wikipedia: Grammar' },
  { title: 'Базовая лексика (топ-1000 слов)', positionX: 3 * GRID_X, positionY: 0, difficulty: 2, resourceType: 'article', resourceUrl: 'https://www.memrise.com/', resourceTitle: 'Memrise' },
  { title: 'Аудирование: простые тексты', positionX: 4 * GRID_X, positionY: -GRID_Y, difficulty: 3, resourceType: 'article', resourceUrl: 'https://www.lingq.com/', resourceTitle: 'LingQ — аудирование и чтение' },
  { title: 'Чтение: адаптированные тексты', positionX: 4 * GRID_X, positionY: GRID_Y, difficulty: 3, resourceType: 'article', resourceUrl: 'https://www.gutenberg.org/', resourceTitle: 'Project Gutenberg' },
  { title: 'Разговорная практика: диалоги', positionX: 5 * GRID_X, positionY: 0, difficulty: 4, resourceType: 'article', resourceUrl: 'https://www.italki.com/', resourceTitle: 'italki — практика с носителями' },
  { title: 'Грамматика среднего уровня', positionX: 6 * GRID_X, positionY: -GRID_Y, difficulty: 5, resourceType: 'article', resourceUrl: 'https://www.reverso.net/', resourceTitle: 'Reverso — грамматика и переводы' },
  { title: 'Письмо: короткие тексты и сообщения', positionX: 6 * GRID_X, positionY: GRID_Y, difficulty: 5, resourceType: 'article', resourceUrl: 'https://www.tandem.net/', resourceTitle: 'Tandem — языковой обмен' },
  { title: 'Погружение: подкасты, курсы, новости', positionX: 7 * GRID_X, positionY: 0, difficulty: 6, resourceType: 'article', resourceUrl: 'https://www.coursera.org/', resourceTitle: 'Coursera — языковые курсы' },
  { title: 'Подготовка к экзамену / сертификату', positionX: 8 * GRID_X, positionY: 0, difficulty: 7, resourceType: 'article', resourceUrl: 'https://www.coe.int/en/web/common-european-framework-reference-languages', resourceTitle: 'CEFR — общеевропейские компетенции владения языком' },
]

const languageConnections: Array<readonly [number, number]> = [
  [0, 1],
  [1, 2], [1, 3],
  [2, 4], [3, 4],
  [4, 5], [4, 6],
  [5, 7], [6, 7],
  [7, 8], [7, 9],
  [8, 10], [9, 10],
  [10, 11],
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
    description: 'Node.js, REST API, PostgreSQL, Redis, очереди, Docker, CI/CD',
    category: 'BACKEND',
    nodes: backendNodes,
    connections: backendConnections,
  },
  {
    id: 'ml',
    title: 'Data Science / Machine Learning',
    description: 'Python, NumPy, Pandas, EDA, Scikit-learn, оценка моделей, нейросети',
    category: 'DATA_SCIENCE',
    nodes: mlNodes,
    connections: mlConnections,
  },
  {
    id: 'language',
    title: 'Иностранный язык с нуля',
    description: 'Произношение, грамматика, лексика, аудирование, разговорная практика, экзамен',
    category: 'LANGUAGES',
    nodes: languageNodes,
    connections: languageConnections,
  },
]

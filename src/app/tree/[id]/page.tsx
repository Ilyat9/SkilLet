import type { Metadata } from 'next'
import { prisma } from '@/shared/lib/prisma'
import { SkillTreePage } from '@/widgets/SkillTreePage'

interface TreePageProps {
  params: Promise<{ id: string }>
}

// SEO/метаданные для шаринга ссылки на дерево.
export async function generateMetadata({ params }: TreePageProps): Promise<Metadata> {
  const { id } = await params

  try {
    const tree = await prisma.tree.findUnique({
      where: { id },
      select: { title: true, description: true, isPublic: true },
    })

    if (!tree) {
      // Строка прогонится через title.template из layout → «... — SkilLet».
      return { title: 'Дерево не найдено' }
    }

    // Мета-теги отдаются и для приватных деревьев (только название),
    // контент при этом остаётся защищён проверкой прав в API и UI.
    const description = tree.isPublic
      ? (tree.description ?? 'Интерактивное skill-дерево обучения')
      : 'Приватное skill-дерево обучения'

    return {
      // Строка прогонится через title.template из layout → «{title} — SkilLet».
      title: tree.title,
      description,
      openGraph: { title: tree.title, description, type: 'website' },
    }
  } catch {
    return { title: 'SkilLet' }
  }
}

export default async function TreePage({ params }: TreePageProps) {
  const { id } = await params
  return <SkillTreePage treeId={id} />
}



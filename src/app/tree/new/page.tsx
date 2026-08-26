'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { TEMPLATES, type SkillTemplate } from '@/shared/constants/templates'
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react'

export default function NewTreePage() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setIsCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Новое дерево',
          description: '',
          isPublic: false,
        }),
      })

      const result = await response.json()
      if (result.error) {
        setError(result.error.message)
        return
      }

      router.push(`/tree/${result.data.id}`)
    } catch (err) {
      console.error('Ошибка создания дерева:', err)
      setError('Ошибка создания дерева')
    } finally {
      setIsCreating(false)
    }
  }

  /** Создаёт дерево из шаблона: Tree → Nodes[] → Edges[] через CRUD API. */
  const handleCreateFromTemplate = async (template: SkillTemplate) => {
    setCreatingTemplateId(template.id)
    setError(null)
    try {
      // 1. Создаём дерево
      const treeResponse = await fetch('/api/trees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          isPublic: false,
        }),
      })
      const treeResult = await treeResponse.json()
      if (treeResult.error) {
        setError(treeResult.error.message)
        return
      }
      const treeId: string = treeResult.data.id

      // 2. Создаём узлы, запоминая id по индексам шаблона
      const createdNodeIds: string[] = []
      for (const node of template.nodes) {
        const nodeResponse = await fetch(`/api/trees/${treeId}/nodes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(node),
        })
        const nodeResult = await nodeResponse.json()
        if (nodeResult.error) {
          setError(nodeResult.error.message)
          router.push(`/tree/${treeId}`)
          return
        }
        createdNodeIds.push(nodeResult.data.id as string)
      }

      // 3. Создаём рёбра по парам индексов
      for (const [sourceIndex, targetIndex] of template.connections) {
        const sourceId = createdNodeIds[sourceIndex]
        const targetId = createdNodeIds[targetIndex]
        if (!sourceId || !targetId) continue

        const edgeResponse = await fetch(`/api/trees/${treeId}/edges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId, targetId }),
        })
        const edgeResult = await edgeResponse.json()
        if (edgeResult.error) {
          console.error('Ошибка создания связи:', edgeResult.error.message)
        }
      }

      router.push(`/tree/${treeId}`)
    } catch (err) {
      console.error('Ошибка создания дерева из шаблона:', err)
      setError('Ошибка создания дерева из шаблона')
    } finally {
      setCreatingTemplateId(null)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Link>

        <div className="bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Создать дерево</h1>
            <p className="text-gray-400">
              Создайте новое дерево навыков для ваших целей
            </p>
          </div>

          <p className="text-gray-500 mb-6 text-sm">
            Платформа SkilLet позволяет создавать интерактивные деревья навыков в формате RPG.
            Вы можете начинать с пустого дерева или выбрать существующее как шаблон.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full"
              size="lg"
            >
              {isCreating ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : null}
              Создать пустое дерево
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              Создать из шаблона
            </Button>
          </div>

          <div className="mt-6 p-4 bg-secondary rounded-lg">
            <h3 className="font-semibold mb-2 text-sm">Что вы хотите создать?</h3>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• Frontend разработка</li>
              <li>• Backend разработка</li>
              <li>• DevOps и Kubernetes</li>
              <li>• AI & Machine Learning</li>
            </ul>
          </div>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Создать из шаблона"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Выберите шаблон для быстрого старта. Шаблоны уже содержат структурированные навыки.
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-1 gap-3">
            {TEMPLATES.map((template) => {
              const isCreatingThis = creatingTemplateId === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  disabled={creatingTemplateId !== null}
                  onClick={() => void handleCreateFromTemplate(template)}
                  className="text-left p-4 bg-card border border-border rounded-lg hover:border-primary cursor-pointer transition-colors disabled:opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{template.title}</h4>
                    {isCreatingThis ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{template.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function NewTreePage() {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    setIsCreating(true)
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
        alert(result.error.message)
        return
      }

      router.push(`/tree/${result.data.id}`)
    } catch (error) {
      console.error('Ошибка создания дерева:', error)
      alert('Ошибка создания дерева')
    } finally {
      setIsCreating(false)
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

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Создать из шаблона"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Выберите шаблон для быстрого старта. Шаблоны уже содержат структурированные навыки.
          </p>
          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 bg-card border border-border rounded-lg hover:border-primary cursor-pointer transition-colors">
              <h4 className="font-semibold">Frontend Разработчик</h4>
              <p className="text-sm text-gray-400">HTML, CSS, JavaScript, React, Next.js, TypeScript</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg hover:border-primary cursor-pointer transition-colors">
              <h4 className="font-semibold">Backend Разработчик</h4>
              <p className="text-sm text-gray-400">Node.js, Python, PostgreSQL, REST API</p>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg hover:border-primary cursor-pointer transition-colors">
              <h4 className="font-semibold">Data Scientist</h4>
              <p className="text-sm text-gray-400">Python, NumPy, Pandas, Scikit-learn</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

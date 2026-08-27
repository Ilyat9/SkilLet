'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/ui/Button'
import { Modal } from '@/shared/ui/Modal'
import { TEMPLATES, type SkillTemplate } from '@/shared/constants/templates'
import { cn } from '@/shared/lib/utils'
import { Loader2, ArrowLeft, Sparkles } from 'lucide-react'

type CreateMode = 'templates' | 'ai'

export default function NewTreePage() {
  const router = useRouter()
  const [mode, setMode] = useState<CreateMode>('templates')

  // Общее состояние «создать пустое дерево»
  const [isCreatingEmpty, setIsCreatingEmpty] = useState(false)
  const [emptyError, setEmptyError] = useState<string | null>(null)

  // Состояние создания из шаблона
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [creatingTemplateId, setCreatingTemplateId] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  // Состояние AI-генерации
  const [topic, setTopic] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  /** Создаёт ПУСТОЕ дерево и переходит в редактор. */
  const handleCreateEmpty = async () => {
    setIsCreatingEmpty(true)
    setEmptyError(null)
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
        setEmptyError(result.error.message)
        return
      }

      router.push(`/tree/${result.data.id}`)
    } catch (err) {
      console.error('Ошибка создания дерева:', err)
      setEmptyError('Ошибка создания дерева')
    } finally {
      setIsCreatingEmpty(false)
    }
  }

  /**
   * Создаёт РЕАЛЬНОЕ дерево из шаблона ОДНИМ запросом:
   * POST /api/trees/from-template сохраняет Tree + Nodes[] + Edges[]
   * единой транзакцией на сервере (паттерн prisma/seed.ts),
   * владелец — текущий авторизованный пользователь.
   */
  const handleCreateFromTemplate = async (template: SkillTemplate) => {
    setCreatingTemplateId(template.id)
    setTemplateError(null)
    try {
      const response = await fetch('/api/trees/from-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          isPublic: false,
          nodes: template.nodes,
          connections: template.connections,
        }),
      })
      const result = await response.json()
      if (result.error) {
        setTemplateError(result.error.message)
        return
      }
      router.push(`/tree/${result.data.id}`)
    } catch (err) {
      console.error('Ошибка импорта шаблона:', err)
      setTemplateError('Ошибка импорта шаблона')
    } finally {
      setCreatingTemplateId(null)
    }
  }

  /** Генерирует дерево по теме через LLM и переходит к созданному дереву. */
  const handleGenerate = async () => {
    if (topic.trim().length < 3) {
      setAiError('Опишите тему хотя бы в 3 символах')
      return
    }
    setIsGenerating(true)
    setAiError(null)
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim() }),
      })
      const result = await response.json()
      if (result.error) {
        setAiError(result.error.message)
        return
      }
      router.push(`/tree/${result.data.treeId}`)
    } catch (err) {
      console.error('Ошибка AI-генерации:', err)
      setAiError('Ошибка AI-генерации. Попробуйте ещё раз.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад
        </Link>

        <div className="bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Создать дерево</h1>
            <p className="text-muted-foreground">
              Создайте новое дерево навыков для ваших целей
            </p>
          </div>

          {/* Вкладки способа создания */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg mb-6" role="tablist">
            {(
              [
                { id: 'templates', label: 'Шаблоны' },
                { id: 'ai', label: 'AI-генерация' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  'py-2 px-3 rounded-md text-sm font-medium transition-colors',
                  mode === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Панель «создать пустое дерево» — доступна из обеих вкладок */}
          <div className="space-y-3">
            <Button onClick={handleCreateEmpty} disabled={isCreatingEmpty} className="w-full" size="lg">
              {isCreatingEmpty ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              Создать пустое дерево
            </Button>

            {mode === 'templates' ? (
              <Button
                onClick={() => setIsTemplateModalOpen(true)}
                variant="secondary"
                className="w-full"
                size="lg"
              >
                Выбрать шаблон
              </Button>
            ) : (
              <div className="space-y-3 pt-2 border-t border-border mt-4">
                <label htmlFor="ai-topic" className="block text-sm font-medium">
                  Тема обучения
                </label>
                <textarea
                  id="ai-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Например: изучение Rust с нуля до написания CLI-приложений"
                  rows={3}
                  maxLength={200}
                  disabled={isGenerating}
                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 resize-none"
                />
                <Button
                  onClick={() => void handleGenerate()}
                  disabled={isGenerating || topic.trim().length < 3}
                  variant="secondary"
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Генерируем дерево (до ~30 сек)…
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 text-primary" />
                      Сгенерировать AI-деревом по теме
                    </>
                  )}
                </Button>
                {isGenerating && (
                  <p className="text-xs text-text-tertiary text-center">
                    Модель придумает 8–20 узлов со связями и ресурсами — останется только учиться.
                  </p>
                )}
              </div>
            )}
          </div>

          {(emptyError || aiError) && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/40 rounded-lg">
              <p className="text-destructive text-sm">{emptyError ?? aiError}</p>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Создать из шаблона"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Выберите шаблон для быстрого старта. Дерево создастся полностью — с узлами и связями,
            и будет принадлежать вам.
          </p>
          {templateError && <p className="text-destructive text-sm">{templateError}</p>}
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
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </button>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

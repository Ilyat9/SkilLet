'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { useAuth } from '@/features/auth/ui/useAuth'
import { Badge } from '@/shared/ui/Badge'
import { Node } from '@/entities/node/model/types'
import { NODE_STATUS } from '@/shared/constants'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import { useToast } from '@/shared/ui/Toast'
import type { Achievement } from '@prisma/client'
import { Lock, CheckCircle2, Loader2 } from 'lucide-react'

interface MarkCompleteButtonProps {
  node: Node
  completedNodeIds: Set<string>
  isCompleted: boolean
  /** Заголовок навыка-пререквизита, из-за которого узел заблокирован (для подсказки). */
  blockedByTitle?: string | null
  onToggle: (completed: boolean) => void
}

interface ProgressApiResponse {
  progress: unknown
  streak: { currentStreak: number; longestStreak: number }
  unlockedAchievements: Achievement[]
}

export function MarkCompleteButton({
  node,
  completedNodeIds,
  isCompleted,
  blockedByTitle = null,
  onToggle,
}: MarkCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const { data: session } = useAuth()
  const { showToast } = useToast()

  if (!session?.user?.id) {
    return <Badge variant="warning">Войдите для прогресса</Badge>
  }

  const handleMarkComplete = async () => {
    setIsLoading(true)
    setIsFailed(false)
    try {
      // treeId не передаём в body — сервер берёт его из URL.
      const response = await fetch(`/api/trees/${node.treeId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          completed: !isCompleted,
        }),
      })

      const result = await response.json()
      if (result.error) {
        setIsFailed(true)
        showToast(result.error.message, 'error')
        return
      }

      onToggle(!isCompleted)

      // Подтверждённые сервером разблокировки показываем тостами.
      const payload = result.data as ProgressApiResponse
      for (const achievement of payload.unlockedAchievements) {
        showToast(`${achievement.icon} Достижение разблокировано: «${achievement.title}»`, 'achievement')
      }
    } catch (error) {
      console.error('Ошибка при обновлении прогресса:', error)
      setIsFailed(true)
      showToast('Ошибка обновления прогресса', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  if (isCompleted) {
    return (
      <Badge variant="success" className="flex items-center gap-2">
        <CheckCircle2 className="w-3 h-3" />
        Пройдено
      </Badge>
    )
  }

  const status = getNodeStatus(node, completedNodeIds)

  if (status === NODE_STATUS.LOCKED) {
    return (
      <div>
        <Badge variant="default" className="flex items-center gap-2 w-full justify-center">
          <Lock className="w-3 h-3" />
          Заблокировано
        </Badge>
        {blockedByTitle && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Сначала пройдите «{blockedByTitle}»
          </p>
        )}
      </div>
    )
  }

  return (
    <Button
      onClick={handleMarkComplete}
      disabled={isLoading}
      variant={isFailed ? 'ghost' : 'secondary'}
      size="sm"
      className={isFailed ? 'w-full text-destructive' : 'w-full'}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mr-2" />
      )}
      {isFailed ? 'Повторить попытку' : 'Отметить пройденным'}
    </Button>
  )
}

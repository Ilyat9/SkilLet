'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { useAuth } from '@/features/auth/ui/useAuth'
import { Badge } from '@/shared/ui/Badge'
import { Node } from '@/entities/node/model/types'
import { NODE_STATUS } from '@/shared/constants'
import { getNodeStatus } from '@/entities/node/model/nodeHelpers'
import { Lock, CheckCircle2, Loader2 } from 'lucide-react'

interface MarkCompleteButtonProps {
  node: Node
  isCompleted: boolean
  onToggle: (completed: boolean) => void
}

export function MarkCompleteButton({ node, isCompleted, onToggle }: MarkCompleteButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { data: session } = useAuth()

  if (!session?.user?.id) {
    return <Badge variant="warning">Войдите для прогресса</Badge>
  }

  const handleMarkComplete = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/trees/${node.treeId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treeId: node.treeId,
          nodeId: node.id,
          completed: !isCompleted,
        }),
      })

      const result = await response.json()
      if (result.error) {
        alert(result.error.message)
        return
      }

      onToggle(!isCompleted)
    } catch (error) {
      console.error('Ошибка при обновлении прогресса:', error)
      alert('Ошибка обновления прогресса')
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

  const status = getNodeStatus(node, new Set())

  if (status === NODE_STATUS.LOCKED) {
    return (
      <Badge variant="default" className="flex items-center gap-2">
        <Lock className="w-3 h-3" />
        Заблокировано
      </Badge>
    )
  }

  return (
    <Button
      onClick={handleMarkComplete}
      disabled={isLoading}
      variant="secondary"
      size="sm"
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <CheckCircle2 className="w-4 h-4 mr-2" />
      )}
      {isCompleted ? 'Отметить непройденным' : 'Отметить пройденным'}
    </Button>
  )
}

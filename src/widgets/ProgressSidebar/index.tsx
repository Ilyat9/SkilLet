'use client'

import { Tree, UserProgress } from '@prisma/client'
import { Badge } from '@/shared/ui/Badge'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { Lock, CheckCircle2 } from 'lucide-react'

interface ProgressSidebarProps {
  tree: Tree
  progress: UserProgress | null
  totalNodes: number
  completedNodes: number
  isLocked: boolean
}

export function ProgressSidebar({
  tree,
  progress,
  totalNodes,
  completedNodes,
  isLocked,
}: ProgressSidebarProps) {
  const percentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0

  if (isLocked) {
    return (
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold">Прогресс</h3>
        </div>
        <p className="text-sm text-gray-400">Доступ заблокирован. Завершите предыдущие навыки.</p>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {progress?.completed ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-gray-600" />
        )}
        <h3 className="font-semibold">Прогресс</h3>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-400">
              {completedNodes} из {totalNodes} навыков
            </span>
            <span className="text-foreground font-semibold">{percentage}%</span>
          </div>
          <ProgressBar value={completedNodes} max={totalNodes} />
        </div>

        {progress?.completed ? (
          <Badge variant="success" className="w-full justify-center">
            Все навыки пройдены! 🎉
          </Badge>
        ) : (
          <div className="text-xs text-gray-400 text-center">
            {completedNodes === 0 ? 'Начните с первого навыка' : 'Продолжайте обучение!'}
          </div>
        )}
      </div>
    </div>
  )
}

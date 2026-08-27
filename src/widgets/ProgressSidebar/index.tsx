'use client'

import { Badge } from '@/shared/ui/Badge'
import { ProgressBar } from '@/shared/ui/ProgressBar'
import { CheckCircle2 } from 'lucide-react'

interface ProgressSidebarProps {
  totalNodes: number
  completedNodes: number
}

export function ProgressSidebar({ totalNodes, completedNodes }: ProgressSidebarProps) {
  const percentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0
  const allCompleted = totalNodes > 0 && completedNodes === totalNodes

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {allCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-success" />
        ) : (
          <div className="w-4 h-4 rounded-full bg-muted-foreground/40" />
        )}
        <h3 className="font-semibold">Прогресс</h3>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {completedNodes} из {totalNodes} навыков
            </span>
            <span className="text-foreground font-semibold">{percentage}%</span>
          </div>
          <ProgressBar value={completedNodes} max={totalNodes} />
        </div>

        {allCompleted ? (
          <Badge variant="success" className="w-full justify-center">
            Все навыки пройдены! 🎉
          </Badge>
        ) : (
          <div className="text-xs text-muted-foreground text-center">
            {completedNodes === 0 ? 'Начните с первого навыка' : 'Продолжайте обучение!'}
          </div>
        )}
      </div>
    </div>
  )
}

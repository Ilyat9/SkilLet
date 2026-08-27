import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  /** Опциональная CTA (кнопка/ссылка). */
  action?: React.ReactNode
  className?: string
}

/**
 * Переиспользуемый пустой состояние-блок: иконка + заголовок + описание + CTA.
 * Используется на дашборде, в каталоге, в дереве без узлов — единый вид.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div className="w-16 h-16 bg-card border border-border rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-text-tertiary" aria-hidden />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {description && <p className="text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>}
      {action && <div className="flex justify-center">{action}</div>}
    </div>
  )
}

import { cn } from '@/shared/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
  /** Доступное название для скринридеров. */
  ariaLabel?: string
}

export function ProgressBar({ value, max = 100, size = 'md', ariaLabel = 'Прогресс' }: ProgressBarProps) {
  const percentage = max === 0 ? 0 : Math.min((value / max) * 100, 100)
  const filled = percentage

  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full bg-muted rounded-full overflow-hidden', {
        'h-2': size === 'sm',
        'h-4': size === 'md',
        'h-6': size === 'lg',
      })}
    >
      <div
        className={cn('h-full transition-[width] duration-300', {
          'bg-success': filled === 100,
          'bg-primary': filled > 0 && filled < 100,
          'bg-transparent': filled === 0,
        })}
        style={{ width: `${filled}%` }}
      />
    </div>
  )
}

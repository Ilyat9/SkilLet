interface ProgressBarProps {
  value: number
  max?: number
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({ value, max = 100, size = 'md' }: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const filled = percentage

  return (
    <div
      className={cn('w-full bg-gray-700 rounded-full overflow-hidden', {
        'h-2': size === 'sm',
        'h-4': size === 'md',
        'h-6': size === 'lg',
      })}
    >
      <div
        className={cn('h-full transition-all duration-300', {
          'bg-success': filled === 100,
          'bg-warning': filled > 0 && filled < 100,
          'bg-gray-600': filled === 0,
        })}
        style={{ width: `${filled}%` }}
      />
    </div>
  )
}

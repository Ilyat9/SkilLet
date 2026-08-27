'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/shared/ui/Button'
import { AlertTriangle } from 'lucide-react'

/**
 * Глобальный error boundary App Router.
 * Ошибка логируется в консоль; при появлении внешнего error-tracking
 * (Sentry и т.п.) интегрировать отправку здесь же.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app-error]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" aria-hidden />
        <h1 className="text-2xl font-bold mb-2">Что-то пошло не так</h1>
        <p className="text-muted-foreground mb-6">
          Произошла непредвиденная ошибка. Попробуйте ещё раз — в большинстве случаев это помогает.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={reset}>Попробовать снова</Button>
          <Button variant="secondary" asChild>
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

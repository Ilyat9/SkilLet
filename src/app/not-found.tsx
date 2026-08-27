import Link from 'next/link'
import { Compass } from 'lucide-react'

/** Стилизованная 404-страница с навигацией на дашборд и главную. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-card border border-border rounded-full flex items-center justify-center mx-auto mb-4">
          <Compass className="w-8 h-8 text-text-tertiary" aria-hidden />
        </div>
        <p className="text-sm font-semibold text-primary mb-1">404</p>
        <h1 className="text-2xl font-bold mb-2">Страница не найдена</h1>
        <p className="text-muted-foreground mb-6">
          Возможно, страница была удалена или её адрес указан неверно.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            К моим деревьям
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-6 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}

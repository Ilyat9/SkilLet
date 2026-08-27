/** Общий skeleton при навигации между роутами (server component). */
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-label="Загрузка страницы">
      <div className="w-full max-w-md px-4 space-y-4">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse mx-auto" />
        <div className="h-4 w-full rounded bg-muted animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-muted animate-pulse mx-auto" />
      </div>
    </div>
  )
}

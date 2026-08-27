/**
 * Skeleton страницы дерева: тулбар, canvas-область и правый сайдбар —
 * повторяет фактическую разметку SkillTreePage, чтобы переход не «прыгал».
 */
export default function TreeLoading() {
  return (
    <div className="h-screen bg-background flex flex-col" role="status" aria-label="Загрузка дерева">
      {/* Тулбар */}
      <div className="bg-card border-b border-border shrink-0">
        <div className="px-3 sm:px-4 py-3 flex items-center gap-4">
          <div className="w-9 h-9 rounded bg-muted animate-pulse shrink-0" />
          <div className="space-y-1.5 min-w-0 flex-1 max-w-xs">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 p-2 sm:p-4 overflow-hidden">
          <div className="h-full w-full rounded-lg border border-border bg-muted/30 animate-pulse" />
        </div>

        {/* Sidebar (desktop) */}
        <aside className="hidden lg:block w-80 border-l border-border p-4 bg-card shrink-0 space-y-4">
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
            <div className="h-3 w-36 rounded bg-muted animate-pulse" />
            <div className="h-4 w-full rounded-full bg-muted animate-pulse" />
          </div>
          <div className="rounded-lg border border-border p-4 h-14 animate-pulse" />
          <div className="rounded-lg border border-border p-4 h-14 animate-pulse" />
        </aside>
      </div>
    </div>
  )
}

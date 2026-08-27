/** Skeleton страницы создания дерева: карточка с выбором способа создания. */
export default function NewTreeLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" role="status" aria-label="Загрузка">
      <div className="w-full max-w-lg space-y-6">
        <div className="h-6 w-52 rounded bg-muted animate-pulse" />
        {[0, 1].map((i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="h-5 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-10 w-36 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

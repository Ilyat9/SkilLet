export async function register() {
  // Graceful shutdown: при SIGTERM (docker stop, Kubernetes, деплой) даём
  // серверу закрыть HTTP-соединения (это делает server.js standalone-сборки —
  // проверено: Next.js standalone обрабатывает SIGTERM/SIGINT через server.close)
  // и корректно закрываем пул соединений Prisma, чтобы не обрубать активные
  // запросы к БД в момент пересборки контейнера.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { prisma } = await import('@/shared/lib/prisma')

    const shutdown = (signal: string) => {
      // server.close() в standalone server.js перестаёт принимать новые
      // соединения и ждёт активные; здесь лишь освобождаем пул БД.
      void prisma.$disconnect().finally(() => {
        process.exit(0)
      })
      // Страховка: не висим дольше 10 секунд.
      setTimeout(() => process.exit(0), 10_000).unref()
      void signal
    }

    process.once('SIGTERM', () => shutdown('SIGTERM'))
    process.once('SIGINT', () => shutdown('SIGINT'))
  }
}
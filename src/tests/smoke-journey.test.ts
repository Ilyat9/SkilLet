import { describe, it, afterAll, vi } from 'vitest'
import { main } from '../../scripts/smoke-user-journey'
import { prisma } from '@/shared/lib/prisma'

// Сессия подменяется так же, как в интеграционных тестах: актуальный
// пользователь smoke-скрипт задаёт через globalThis (setUser).
vi.mock('@/shared/lib/auth', () => ({
  auth: async () => ({
    user: { id: (globalThis as unknown as Record<string, string | undefined>).__skilletTestUserId ?? '' },
  }),
}))

// Сквозной smoke пользовательского сценария README — прогоняется как «тест»,
// чтобы использовать alias server-only из vitest.config (роуты его импортируют).
// Работает на dev-БД (DATABASE_URL), на seed-данных; в конце чистит за собой.
describe('Smoke: полный пользовательский сценарий README', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('вход → каталог → лайк → комментарий → форк → создание → экспорт/импорт', async () => {
    await main()
  }, 60_000)
})
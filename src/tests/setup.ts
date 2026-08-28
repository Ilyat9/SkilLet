/**
 * Глобальная подготовка окружения для тестов.
 * Выполняется до импорта тест-файлов: PrismaClient читает DATABASE_URL
 * в момент создания singleton, поэтому перенаправляем его в тестовую БД.
 */
const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/skillet_test'

process.env.DATABASE_URL = TEST_DB_URL
process.env.AUTH_SECRET ??= 'test-secret-do-not-use-in-production'
process.env.NEXTAUTH_URL ??= 'http://localhost:3000'

export {}
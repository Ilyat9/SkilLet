import { execSync } from 'node:child_process'

/**
 * Глобальная подготовка тестовой БД: применяем миграции (prisma migrate deploy —
 * тот же механизм, что и в проде) до запуска интеграционных тестов.
 * Идемпотентно: миграции уже применены — шаг мгновенно проходит.
 */
export default function setup() {
  const testDbUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/skillet_test'

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testDbUrl },
  })
}
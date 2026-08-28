import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // server-only бросает исключение вне React Server Components окружения —
      // в интеграционных тестах API-роутов подменяем на пустой модуль.
      'server-only': fileURLToPath(new URL('./src/tests/mocks/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/tests/setup.ts'],
    globalSetup: ['src/tests/globalSetup.ts'],
    testTimeout: 30_000,
  },
})

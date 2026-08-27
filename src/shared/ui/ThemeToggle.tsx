'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'skillet-theme'

/** Читает сохранённую тему (или системную), не вызывая побочных эффектов SSR. */
function getCurrentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * Переключатель светлой/тёмной темы.
 * Выбор хранится в localStorage; применение класса .dark на <html>
 * выполняет inline-скрипт до первого рендера (см. layout.tsx) — здесь только toggle.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(getCurrentTheme())
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // localStorage может быть недоступен (приватный режим) — тема всё равно применится.
    }
    setTheme(next)
  }

  // До монтирования рендерим стабильную заглушку, чтобы избежать hydration mismatch.
  if (!mounted) {
    return <span className="inline-flex w-9 h-9" aria-hidden />
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      className="p-2 rounded-md text-text-secondary hover:text-foreground hover:bg-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" aria-hidden />
      ) : (
        <Moon className="w-5 h-5" aria-hidden />
      )}
    </button>
  )
}
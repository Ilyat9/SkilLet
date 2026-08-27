'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { signOut } from 'next-auth/react'
import { Button } from '@/shared/ui/Button'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { Flame, LogOut, Menu, X } from 'lucide-react'

interface StreakInfo {
  currentStreak: number
}

/** Иконка текущей серии дней рядом с профилем. Подтягивается один раз при маунте. */
function StreakBadge() {
  const [streak, setStreak] = useState<StreakInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchStreak = async () => {
      try {
        const response = await fetch('/api/profile')
        if (!response.ok) return
        const result = await response.json()
        if (!cancelled && result.data) {
          setStreak({ currentStreak: result.data.stats.currentStreak as number })
        }
      } catch {
        // В хедере ошибка загрузки streak некритична — просто не показываем бейдж.
      }
    }
    void fetchStreak()
    return () => {
      cancelled = true
    }
  }, [])

  if (!streak || streak.currentStreak < 1) return null

  return (
    <span
      className="flex items-center gap-1 text-sm text-warning font-medium"
      title={`Серия изучения: ${streak.currentStreak} дн.`}
    >
      <Flame className="w-4 h-4" />
      {streak.currentStreak}
    </span>
  )
}

export function Header() {
  const { data: session, status } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  if (status === 'loading') {
    return null
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl text-foreground">SkilLet</span>
          </Link>

          <div className="flex items-center gap-2">
            {session?.user ? (
              <>
                {/* Desktop-навигация: ссылки видны от sm и выше. */}
                <nav className="hidden sm:flex items-center gap-4" aria-label="Основная навигация">
                  <Link href="/dashboard" className="text-text-secondary hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary px-1 py-0.5">
                    Дашборд
                  </Link>
                  <Link href="/explore" className="text-text-secondary hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary px-1 py-0.5">
                    Каталог
                  </Link>
                  <Link href="/tree/new" className="text-text-secondary hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary px-1 py-0.5">
                    Создать дерево
                  </Link>
                </nav>
                <div className="flex items-center gap-2 sm:gap-3 ml-1 sm:ml-4 pl-2 sm:pl-4 border-l border-border">
                  <ThemeToggle />
                  <StreakBadge />
                  <Link
                    href="/profile"
                    aria-label={session.user.name ? `Профиль: ${session.user.name}` : 'Профиль'}
                    className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {session.user.image ? (
                      <Image
                        src={session.user.image}
                        alt={session.user.name || 'User'}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <span className="text-sm text-text-secondary hover:text-foreground transition-colors">Профиль</span>
                    )}
                  </Link>
                  <button
                    onClick={handleLogout}
                    aria-label="Выйти из аккаунта"
                    className="hidden md:flex items-center gap-1 text-xs text-text-secondary hover:text-destructive transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <LogOut className="w-3 h-3" aria-hidden />
                    Выйти
                  </button>

                  {/* Гамбургер: ниже md вместо строки ссылок. */}
                  <button
                    onClick={() => setIsMobileMenuOpen((v) => !v)}
                    className="md:hidden p-2 rounded-md text-text-secondary hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={isMobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="mobile-menu"
                  >
                    {isMobileMenuOpen ? (
                      <X className="w-5 h-5" aria-hidden />
                    ) : (
                      <Menu className="w-5 h-5" aria-hidden />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <Button onClick={() => (window.location.href = '/login')} size="sm">
                Войти
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Мобильное меню: выпадающая панель под хедером (ниже md). */}
      {session?.user && isMobileMenuOpen && (
        <nav
          id="mobile-menu"
          aria-label="Мобильная навигация"
          className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1 shadow-lg"
        >
          <Link
            href="/dashboard"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-2 py-2 rounded-md text-sm text-text-secondary hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Дашборд
          </Link>
          <Link
            href="/explore"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-2 py-2 rounded-md text-sm text-text-secondary hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Каталог
          </Link>
          <Link
            href="/tree/new"
            onClick={() => setIsMobileMenuOpen(false)}
            className="block px-2 py-2 rounded-md text-sm text-text-secondary hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Создать дерево
          </Link>
          <button
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-text-secondary hover:text-destructive hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut className="w-4 h-4" aria-hidden />
            Выйти
          </button>
        </nav>
      )}
    </header>
  )
}

/**
 * Общий хедер показывается только на /dashboard и /tree/*.
 * На лендинге (/) и /login он скрыт по дизайну.
 */
export function ConditionalHeader() {
  const pathname = usePathname()

  if (pathname === '/' || pathname === '/login') {
    return null
  }

  return <Header />
}

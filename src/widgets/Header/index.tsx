'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { signOut } from 'next-auth/react'
import { Button } from '@/shared/ui/Button'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { Flame, LogOut } from 'lucide-react'

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

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' })
  }

  if (status === 'loading') {
    return null
  }

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl text-foreground">SkilLet</span>
          </Link>

          <nav className="flex items-center gap-4">
            {session?.user ? (
              <>
                <Link href="/dashboard" className="text-text-secondary hover:text-foreground transition-colors">
                  Дашборд
                </Link>
                <Link href="/explore" className="hidden sm:block text-text-secondary hover:text-foreground transition-colors">
                  Каталог
                </Link>
                <Link href="/tree/new" className="hidden sm:block text-text-secondary hover:text-foreground transition-colors">
                  Создать дерево
                </Link>
                <div className="flex items-center gap-3 ml-2 sm:ml-4 pl-2 sm:pl-4 border-l border-border">
                  <ThemeToggle />
                  <StreakBadge />
                  <Link href="/profile">
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
                  <div className="hidden md:flex flex-col">
                    <span className="text-sm text-foreground">{session.user.name || session.user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-text-secondary hover:text-destructive transition-colors mt-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Выйти
                    </button>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="md:hidden p-1 text-text-secondary hover:text-destructive transition-colors"
                    aria-label="Выйти"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Button onClick={() => (window.location.href = '/login')}>Войти</Button>
            )}
          </nav>
        </div>
      </div>
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

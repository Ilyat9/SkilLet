'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/features/auth/ui/useAuth'
import { signOut } from 'next-auth/react'
import { Button } from '@/shared/ui/Button'
import { LogOut } from 'lucide-react'

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
                <Link href="/dashboard" className="text-gray-400 hover:text-foreground transition-colors">
                  Дашборд
                </Link>
                <Link href="/tree/new" className="text-gray-400 hover:text-foreground transition-colors">
                  Создать дерево
                </Link>
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
                  {session.user.image && (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      width={32}
                      height={32}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm text-foreground">{session.user.name || session.user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition-colors mt-1"
                    >
                      <LogOut className="w-3 h-3" />
                      Выйти
                    </button>
                  </div>
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

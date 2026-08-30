'use client'

import { useEffect } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { AuthButton } from '@/features/auth/ui/AuthButton'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const { data: session, status } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  // Навигация авторизованного пользователя — в эффекте, а не во время рендера.
  useEffect(() => {
    if (session) {
      router.push(callbackUrl)
    }
  }, [session, callbackUrl, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" role="status" aria-label="Загрузка">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 space-y-4 animate-pulse">
          <div className="h-8 w-24 rounded bg-muted mx-auto" />
          <div className="h-4 w-56 rounded bg-muted mx-auto" />
          <div className="h-12 w-full rounded-md bg-muted mt-6" />
        </div>
      </div>
    )
  }

  if (session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" role="status" aria-label="Перенаправление">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-8 space-y-4 animate-pulse">
          <div className="h-8 w-24 rounded bg-muted mx-auto" />
          <div className="h-4 w-56 rounded bg-muted mx-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <div className="bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Вход</h1>
            <p className="text-muted-foreground">
              Войдите через GitHub для доступа к платформе
            </p>
          </div>

          <AuthButton />
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Продолжая, вы соглашаетесь с{' '}
          <Link href="/privacy" className="underline hover:text-foreground transition-colors">
            политикой конфиденциальности
          </Link>
        </p>
      </div>
    </div>
  )
}

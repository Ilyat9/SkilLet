'use client'

import { useState } from 'react'
import { useAuth } from '@/features/auth/ui/useAuth'
import { AuthButton } from '@/features/auth/ui/AuthButton'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const { data: session, status } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  const [isLoading, setIsLoading] = useState(false)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (session) {
    router.push(callbackUrl)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <div className="bg-card border border-border rounded-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Вход</h1>
            <p className="text-gray-400">
              Войдите через GitHub для доступа к платформе
            </p>
          </div>

          <AuthButton />
        </div>
      </div>
    </div>
  )
}

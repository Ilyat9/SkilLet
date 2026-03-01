'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/shared/ui/Button'
import { Github } from 'lucide-react'

export function AuthButton() {
  return (
    <Button
      onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
      className="w-full"
      size="lg"
    >
      <Github className="w-5 h-5 mr-2" />
      Войти через GitHub
    </Button>
  )
}

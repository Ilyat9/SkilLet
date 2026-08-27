'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/features/auth/ui/useAuth'
import { ACHIEVEMENT_DEFS, type AchievementDef } from '@/shared/lib/gamification'
import { Badge } from '@/shared/ui/Badge'
import { Loader2, Flame, CheckCircle2, TreePine, Trophy } from 'lucide-react'

interface ProfileApiResponse {
  user: {
    name: string | null
    image: string | null
    email: string | null
    currentStreak: number
    longestStreak: number
    lastActivityDate: string | null
  }
  stats: {
    completedNodes: number
    createdTrees: number
    currentStreak: number
    longestStreak: number
  }
  achievements: Array<{
    code: string
    title: string
    description: string
    icon: string
    unlockedAt: string
  }>
}

export default function ProfilePage() {
  const { status } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<ProfileApiResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status !== 'authenticated') return

    const fetchProfile = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/profile')
        const result = await response.json()
        if (result.error) {
          setError(result.error.message)
          return
        }
        setProfile(result.data as ProfileApiResponse)
      } catch (err) {
        console.error('Ошибка загрузки профиля:', err)
        setError('Не удалось загрузить профиль')
      } finally {
        setIsLoading(false)
      }
    }

    void fetchProfile()
  }, [status, router])

  if (status === 'loading' || (isLoading && !profile && !error)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Профиль недоступен</h1>
          <p className="text-muted-foreground mb-4">{error ?? 'Не удалось загрузить данные'}</p>
          <button className="text-primary hover:underline" onClick={() => router.push('/dashboard')}>
            Вернуться на дашборд
          </button>
        </div>
      </div>
    )
  }

  const unlockedCodes = new Set(profile.achievements.map((a) => a.code))
  const isUnlocked = (def: AchievementDef) => unlockedCodes.has(def.code)

  const statCards = [
    { icon: CheckCircle2, label: 'Пройдено узлов', value: profile.stats.completedNodes },
    { icon: TreePine, label: 'Создано деревьев', value: profile.stats.createdTrees },
    { icon: Flame, label: 'Текущий streak', value: profile.stats.currentStreak },
    { icon: Flame, label: 'Лучший streak', value: profile.stats.longestStreak },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Шапка профиля */}
        <div className="flex items-center gap-4">
          {profile.user.image ? (
            <Image src={profile.user.image} alt={profile.user.name ?? 'User'} width={64} height={64} className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center text-2xl font-bold">
              {(profile.user.name ?? '?').charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold">{profile.user.name ?? 'Пользователь'}</h1>
            {profile.user.email && <p className="text-muted-foreground text-sm">{profile.user.email}</p>}
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-lg p-4">
              <Icon className="w-5 h-5 text-primary mb-2" />
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        {/* Достижения */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Достижения ({profile.achievements.length}/{ACHIEVEMENT_DEFS.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ACHIEVEMENT_DEFS.map((def) => {
              const unlocked = isUnlocked(def)
              return (
                <div
                  key={def.code}
                  className={`rounded-lg border p-4 transition-colors ${
                    unlocked
                      ? 'bg-accent/10 border-accent/50'
                      : 'bg-card border-border opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-2xl" aria-hidden>{def.icon}</span>
                    {unlocked ? (
                      <Badge variant="success">Получено</Badge>
                    ) : (
                      <Badge variant="default">Заблокировано</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mt-2">{def.title}</h3>
                  <p className="text-sm text-muted-foreground">{def.description}</p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

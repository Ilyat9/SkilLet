'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useAuth } from '@/features/auth/ui/useAuth'
import { invalidateProfileSummary } from '@/widgets/Header/useProfileSummary'
import { ACHIEVEMENT_DEFS, type AchievementDef } from '@/shared/lib/gamification'
import { Badge } from '@/shared/ui/Badge'
import { Flame, CheckCircle2, TreePine, Trophy, Gift } from 'lucide-react'

interface ProfileApiResponse {
  user: {
    name: string | null
    image: string | null
    avatarUrl: string | null
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
  // Выбранный аватар (null — фото GitHub). Оптимистично меняем на клиенте.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isAvatarSaving, setIsAvatarSaving] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const applyAvatar = async (next: string | null) => {
    if (isAvatarSaving) return
    setIsAvatarSaving(true)
    const previous = avatarUrl
    setAvatarUrl(next) // оптимистично
    try {
      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: next }),
      })
      if (!response.ok) throw new Error('save failed')
      // Хедер читает профиль через отдельный кэш — сбрасываем, чтобы новый
      // аватар появился сразу, без перезагрузки страницы.
      invalidateProfileSummary()
    } catch {
      setAvatarUrl(previous) // откат при ошибке
      setAvatarError('Не удалось сохранить аватар. Проверьте соединение и попробуйте ещё раз.')
    } finally {
      setIsAvatarSaving(false)
    }
  }

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
        setAvatarUrl((result.data as ProfileApiResponse).user.avatarUrl ?? null)
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
    /* Skeleton профиля: шапка + карточки статистики — согласован со структурой страницы. */
    return (
      <div className="min-h-screen bg-background" role="status" aria-label="Загрузка профиля">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-48 rounded bg-muted animate-pulse" />
              <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 space-y-2 animate-pulse">
                <div className="h-5 w-5 rounded bg-muted" />
                <div className="h-7 w-10 rounded bg-muted" />
                <div className="h-3 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
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

  // Эффективный аватар: выбранный в профиле → фото GitHub → инициалы.
  const effectiveAvatar = avatarUrl ?? profile.user.image
  // DiceBear — детерминированные генеративные SVG (не нейросеть, бесплатно).
  // Сид = email/имя пользователя, поэтому наборы у всех разные, но стабильные.
  const avatarSeed = encodeURIComponent(profile.user.email ?? profile.user.name ?? 'user')
  const avatarOptions = [
    { label: 'Notionists', url: `https://api.dicebear.com/9.x/notionists/svg?seed=${avatarSeed}` },
    { label: 'Open Peeps', url: `https://api.dicebear.com/9.x/open-peeps/svg?seed=${avatarSeed}` },
    { label: 'Micah', url: `https://api.dicebear.com/9.x/micah/svg?seed=${avatarSeed}` },
    { label: 'Big Smile', url: `https://api.dicebear.com/9.x/big-smile/svg?seed=${avatarSeed}` },
    { label: 'Avataaars', url: `https://api.dicebear.com/9.x/avataaars/svg?seed=${avatarSeed}` },
    { label: 'Personas', url: `https://api.dicebear.com/9.x/personas/svg?seed=${avatarSeed}` },
    { label: 'Adventurer', url: `https://api.dicebear.com/9.x/adventurer/svg?seed=${avatarSeed}` },
    { label: 'Инициалы', url: `https://api.dicebear.com/9.x/initials/svg?seed=${avatarSeed}` },
  ]

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
          {effectiveAvatar ? (
            <Image
              src={effectiveAvatar}
              alt={profile.user.name ?? 'User'}
              width={64}
              height={64}
              className="w-16 h-16 rounded-full"
              unoptimized={effectiveAvatar.endsWith('.svg')}
            />
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

        {/* Выбор аватара: генеративные наборы DiceBear (бесплатные, не нейросеть) + фото GitHub */}
        <section aria-label="Выбор аватара">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Аватар</h2>
          {avatarError && (
            <p role="alert" className="mb-3 text-sm text-destructive">
              {avatarError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {avatarOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => void applyAvatar(option.url)}
                disabled={isAvatarSaving}
                title={option.label}
                aria-label={`Выбрать аватар «${option.label}»`}
                aria-pressed={avatarUrl === option.url}
                className={`rounded-full overflow-hidden border-2 transition-colors ${
                  avatarUrl === option.url ? 'border-primary' : 'border-transparent hover:border-border'
                } disabled:opacity-50`}
              >
                <Image src={option.url} alt="" width={48} height={48} className="w-12 h-12" unoptimized />
              </button>
            ))}
            {profile.user.image && (
              <button
                onClick={() => void applyAvatar(null)}
                disabled={isAvatarSaving}
                title="Фото GitHub"
                aria-label="Вернуть фото GitHub"
                aria-pressed={avatarUrl === null}
                className={`rounded-full overflow-hidden border-2 transition-colors ${
                  avatarUrl === null ? 'border-primary' : 'border-transparent hover:border-border'
                } disabled:opacity-50`}
              >
                <Image src={profile.user.image} alt="" width={48} height={48} className="w-12 h-12" />
              </button>
            )}
          </div>
        </section>

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
              // Несекретные видны целиком; секретные до разблокировки прячут
              // содержание — виден только намёк, что достижение существует.
              const isHiddenSecret = Boolean(def.secret) && !unlocked
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
                    {isHiddenSecret ? (
                      /* Секретное до разблокировки: нейтральная обёртка вместо
                         иконки достижения — не спойлерим содержимое. */
                      <Gift className="w-6 h-6 text-text-tertiary" aria-hidden />
                    ) : (
                      /* Иконка из каталога достижений — компонент lucide
                         (тот же паттерн, что и statCards выше). */
                      (() => {
                        const Icon = def.icon
                        return (
                          <Icon
                            className={`w-6 h-6 ${unlocked ? 'text-accent-strong' : 'text-text-tertiary'}`}
                            aria-hidden
                          />
                        )
                      })()
                    )}
                    {unlocked ? (
                      <Badge variant="success">Получено</Badge>
                    ) : (
                      <Badge variant="default">{isHiddenSecret ? 'Секретное' : 'Заблокировано'}</Badge>
                    )}
                  </div>
                  <h3 className="font-semibold mt-2">{isHiddenSecret ? 'Секретное достижение' : def.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {isHiddenSecret ? 'Получите его, чтобы узнать, что за ним скрывается' : def.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

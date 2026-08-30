'use client'

import { useEffect, useSyncExternalStore } from 'react'

export interface ProfileSummary {
  currentStreak: number
  avatarUrl: string | null
  image: string | null
  name: string | null
}

// Модульный кэш: Header рендерит и streak, и аватар — оба читают один
// и тот же запрос /api/profile вместо двух параллельных.
let cache: ProfileSummary | null = null
let inFlight: Promise<ProfileSummary | null> | null = null

// Подписчики (смонтированные компоненты хедера) — им нужен сигнал, что кэш
// изменился: без этого после invalidateProfileSummary() уже открытые страницы
// показывали старый аватар до перезагрузки страницы.
const listeners = new Set<() => void>()

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ProfileSummary | null {
  return cache
}

function getServerSnapshot(): ProfileSummary | null {
  return null
}

async function fetchProfileSummary(): Promise<ProfileSummary | null> {
  if (cache) return cache
  inFlight ??= (async () => {
    try {
      const response = await fetch('/api/profile')
      if (!response.ok) return null
      const result = await response.json()
      if (!result.data) return null
      cache = {
        currentStreak: result.data.stats.currentStreak as number,
        avatarUrl: (result.data.user.avatarUrl as string | null) ?? null,
        image: (result.data.user.image as string | null) ?? null,
        name: (result.data.user.name as string | null) ?? null,
      }
      notify()
      return cache
    } catch {
      return null
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/** Один общий снимок профиля (streak + аватар) для компонентов хедера. */
export function useProfileSummary(): ProfileSummary | null {
  const summary = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Первая загрузка на клиенте: если кэш пуст — тянем /api/profile,
  // результат придёт всем подписчикам через notify().
  useEffect(() => {
    void fetchProfileSummary()
  }, [])

  return summary
}

/**
 * Сброс кэша (после смены аватара в профиле). Уже смонтированные компоненты
 * получают уведомление и сразу подтягивают свежие данные — без перезагрузки
 * страницы.
 */
export function invalidateProfileSummary(): void {
  cache = null
  notify()
  void fetchProfileSummary()
}


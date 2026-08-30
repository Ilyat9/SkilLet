'use client'

import { useEffect, useState } from 'react'

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
  const [summary, setSummary] = useState<ProfileSummary | null>(cache)

  useEffect(() => {
    if (cache) {
      setSummary(cache)
      return
    }
    let cancelled = false
    void fetchProfileSummary().then((data) => {
      if (!cancelled && data) setSummary(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return summary
}

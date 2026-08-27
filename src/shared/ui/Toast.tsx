'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Trophy } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

type ToastVariant = 'success' | 'error' | 'achievement'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/** Хук доступа к тостам. Работает только внутри <ToastProvider>. */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast должен использоваться внутри ToastProvider')
  }
  return context
}

const AUTO_DISMISS_MS = 5000

const VARIANT_CONFIG = {
  success: { icon: CheckCircle2, classes: 'border-green-600/50 bg-card' },
  error: { icon: AlertCircle, classes: 'border-red-600/50 bg-card' },
  achievement: { icon: Trophy, classes: 'border-yellow-500/60 bg-yellow-950/80' },
} as const

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextIdRef = useRef(1)

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = nextIdRef.current
      nextIdRef.current += 1
      setToasts((prev) => [...prev, { id, message, variant }])
      window.setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
    },
    [removeToast]
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Контейнер тостов — поверх всего, включая модалки. */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => {
          const config = VARIANT_CONFIG[toast.variant]
          const Icon = config.icon
          return (
            <div
              key={toast.id}
              className={cn(
                'flex items-start gap-2 border rounded-lg p-3 shadow-lg text-sm',
                config.classes
              )}
            >
              <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', toast.variant === 'error' ? 'text-red-400' : toast.variant === 'achievement' ? 'text-yellow-400' : 'text-green-400')} />
              <span className="text-foreground">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="ml-auto text-gray-400 hover:text-foreground shrink-0">
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

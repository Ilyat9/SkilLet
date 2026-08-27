'use client'

import { ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useFocusTrap } from './useFocusTrap'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Доступная модалка: role="dialog" + aria-modal + aria-labelledby,
 * focus trap (useFocusTrap), закрытие по Escape и по клику на фон,
 * автофокус внутрь и возврат фокуса на открывший элемент.
 */
export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useFocusTrap({ containerRef: panelRef, isActive: isOpen, onEscape: onClose })

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Фон-скримин: декоративный, клик закрывает. */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-lg focus:outline-none"
      >
        {title && (
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Закрыть окно"
              className={cn(
                'p-1 rounded hover:bg-secondary transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              )}
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          </div>
        )}
        <div className="p-4 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

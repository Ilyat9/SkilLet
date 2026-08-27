'use client'

import { useEffect, type MutableRefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface FocusTrapOptions {
  /** Контейнер, внутри которого «запирается» фокус (пANEL модалки/drawer). */
  containerRef: MutableRefObject<HTMLElement | null>
  /** Активен ли trap (модалка открыта). */
  isActive: boolean
  /** Вызывается при нажатии Escape. */
  onEscape?: () => void
}

/**
 * Компактный focus trap для модальных окон и drawer'ов:
 * - автофокус на первый интерактивный элемент при открытии;
 * - Tab/Shift+Tab не выводят фокус за пределы контейнера;
 * - Escape вызывает onEscape;
 * - при закрытии фокус возвращается на элемент, открывший модалку.
 */
export function useFocusTrap({ containerRef, isActive, onEscape }: FocusTrapOptions): void {
  useEffect(() => {
    if (!isActive) return

    const container = containerRef.current
    if (!container) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const getFocusableElements = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    // Автофокус: первый интерактивный элемент, иначе сам контейнер.
    const firstTarget = getFocusableElements()[0] ?? container
    firstTarget.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onEscape?.()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements()
      if (elements.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      const active = document.activeElement

      if (first && last) {
        if (event.shiftKey && active === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && active === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Возвращаем фокус туда, где он был до открытия.
      previouslyFocused?.focus()
    }
    // Handlers намеренно не включены в deps: trap монтируется только по переключению isActive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, containerRef])
}

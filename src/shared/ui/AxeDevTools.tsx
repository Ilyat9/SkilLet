'use client'

import { useEffect } from 'react'

/**
 * Dev-only автоматическая a11y-проверка через axe-core.
 * В development сканирует DOM после мутаций и печатает нарушения в консоль.
 * В production не подключается вовсе (компонент рендерится условно в providers.tsx).
 *
 * Почему не @axe-core/react: он монтирует UI-виджет через ReactDOM.render,
 * который удалён в React 19 — используем axe-core напрямую и логируем в консоль.
 */
export function AxeDevTools() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let observer: MutationObserver | null = null
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    void import('axe-core').then((axe) => {
      if (cancelled) return

      const runScan = () => {
        void axe
          .run(document, { resultTypes: ['violations'] })
          .then((results) => {
            for (const violation of results.violations) {
              console.warn(
                `[a11y] ${violation.id}: ${violation.help}`,
                violation.nodes.map((node) => node.target)
              )
            }
          })
          .catch(() => {
            // Сканы axe не должны ломать dev-страницу.
          })
      }

      runScan()

      observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(runScan, 1000)
      })
      observer.observe(document.body, { subtree: true, childList: true, attributes: true })
    })

    return () => {
      cancelled = true
      observer?.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [])

  return null
}

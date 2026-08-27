"use client"

import { SessionProvider } from "next-auth/react"
import { ToastProvider } from "@/shared/ui/Toast"
import { AxeDevTools } from "@/shared/ui/AxeDevTools"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
        {/* Автопроверка доступности только в dev; в проде код не подключается. */}
        {process.env.NODE_ENV !== 'production' && <AxeDevTools />}
      </ToastProvider>
    </SessionProvider>
  )
}

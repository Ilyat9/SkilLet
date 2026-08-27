import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Providers from "./providers"
import { ConditionalHeader } from "@/widgets/Header"

export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: 'SkilLet — учи навыки как RPG-персонаж',
    template: '%s — SkilLet',
  },
  description: 'Интерактивная платформа для обучения в формате RPG skill-tree: создавайте деревья навыков, отмечайте прогресс, получайте достижения и держите streak.',
  openGraph: {
    title: 'SkilLet — Skill Tree Learning Platform',
    description:
      'Превратите обучение в игру: визуальные skill-деревья, прогресс по узлам, достижения и серия дней (streak).',
    type: 'website',
    siteName: 'SkilLet',
  },
  twitter: {
    card: 'summary',
    title: 'SkilLet — Skill Tree Learning Platform',
    description: 'Обучение в формате RPG skill-tree: деревья навыков, прогресс, достижения.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <ConditionalHeader />
          {children}
        </Providers>
      </body>
    </html>
  )
}

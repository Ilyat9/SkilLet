import type { Metadata } from "next"
import { Geist, Geist_Mono, EB_Garamond } from "next/font/google"
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
  subsets: ["latin", "cyrillic"],
})

/* Заголовочная антиква переписчика. EB Garamond, а не Spectral/Cinzel:
   у Spectral нет кириллицы (а интерфейс русский), Cinzel — уже клише. */
const displaySerif = EB_Garamond({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
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
      <head>
        {/*
          Применяем тему ДО первого рендера, чтобы не было мигания (FOUC):
          приоритет — localStorage, затем системная настройка; по умолчанию тёмная.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('skillet-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.classList.toggle('dark',t==='dark')}catch(e){document.documentElement.classList.add('dark')}})()`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          <ConditionalHeader />
          {children}
        </Providers>
      </body>
    </html>
  )
}

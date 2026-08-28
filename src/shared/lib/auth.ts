import 'server-only'
import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  // Явная JWT-стратегия сессий:
  // 1) колбэки ниже (jwt/session) написаны под token-поток — с PrismaAdapter
  //    дефолтом была бы database-стратегия, где token undefined и session.user.id
  //    не заполнялся бы;
  // 2) без обращения к БД на каждый запрос — дешевле и serverless-совместимо.
  // users/account связываются адаптером как раньше.
  session: { strategy: 'jwt' },
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  // CSRF: мутирующие API-роуты (/api/trees*, /api/ai/*, /api/profile) защищены
  // сессионной cookie: Auth.js v5 по умолчанию ставит sameSite: 'lax', поэтому
  // кросс-сайтовые POST/PATCH/DELETE из чужих origin не несут cookie сессии.
  // NextAuth-эндпоинты (/api/auth/*) дополнительно защищены встроенным
  // CSRF-токеном и state-флоу OAuth. Отдельная CORS-политика не открывалась:
  // Access-Control-Allow-Origin нигде не выставляется — сторонние origin
  // не могут ни читать ответы, ни мутировать данные.
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})

export { useSession as useAuth } from 'next-auth/react'

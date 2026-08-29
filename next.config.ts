import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },
  // standalone нужен только для self-hosted Docker-образа (см. Dockerfile).
  // Vercel собирает стандартным пайплайном — standalone там не нужен и не используется.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' as const } : {}),
  // Базовые security-заголовки для прод-деплоя.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // HSTS: принудительный HTTPS в браузере после первого визита.
          // Безопасно и для localhost-разработки (браузер игнорирует на http).
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          /*
           * Content-Security-Policy — построчное обоснование источников:
           * - default-src 'self'          — всё неописанное явно запрещено (fail-closed);
           * - script-src 'self' 'unsafe-inline' — 'self' для бандлов Next.js; 'unsafe-inline'
           *   обязателен: Next.js встраивает bootstrap-<script> в HTML каждой страницы
           *   (hydration-данные и runtime-конфиг). Без nonce-механизма middleware это
           *   минимально ограничительная политика, совместимая с Next.js App Router;
           * - style-src 'self' 'unsafe-inline'  — 'self' для Tailwind-бандла; 'unsafe-inline'
           *   для React inline style-атрибутов (позиции узлов ReactFlow задаются
           *   style={{ left, top }} — без этого граф не рендерится);
           * - img-src 'self' data: https://api.dicebear.com — data: для inline-иконок/SVG-блобов,
           *   dicebear — внешний генератор аватаров (images.remotePatterns ниже уже
           *   разрешает его для next/image; CSP должен разрешать то же самое);
           * - connect-src 'self'          — клиент обращается только к своим API-роутам;
           *   GitHub OAuth работает через браузерную навигацию (не XHR), поэтому
           *   github.com в connect-src не нужен;
           * - font-src 'self'             — шрифты только локальные (next/font);
           * - object-src 'none'           — плагины <object>/<embed> запрещены полностью;
           * - base-uri 'self'             — защита от подмены базового URL для относительных ссылок;
           * - form-action 'self'          — формы (в т.ч. signIn NextAuth) отправляются только себе;
           * - frame-ancestors 'self'      — дублирует X-Frame-Options для современных браузеров.
           */
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://api.dicebear.com",
              "connect-src 'self'",
              "font-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig


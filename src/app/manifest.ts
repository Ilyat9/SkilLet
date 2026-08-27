import type { MetadataRoute } from 'next'

/** PWA/web-app манифест. Цвета повторяют тёмную тему приложения (globals.css). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SkilLet — учи навыки как RPG-персонаж',
    short_name: 'SkilLet',
    description:
      'Интерактивная платформа для обучения в формате RPG skill-tree: деревья навыков, прогресс, достижения и streak.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020817',
    theme_color: '#15803d',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  }
}

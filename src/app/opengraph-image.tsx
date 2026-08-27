import { ImageResponse } from 'next/og'

export const alt = 'SkilLet — Skill Tree Learning Platform'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Дефолтная og:image для всех страниц (рендерится через next/og).
 * Ссылки на продукт красиво разворачиваются при шаринге в соцсетях/мессенджерах.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#020817',
          color: '#f0fdf4',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 96,
            height: 96,
            borderRadius: 24,
            backgroundColor: '#15803d',
            fontSize: 64,
            fontWeight: 700,
            marginBottom: 32,
          }}
        >
          S
        </div>
        <div style={{ fontSize: 72, fontWeight: 700, marginBottom: 16 }}>SkilLet</div>
        <div style={{ fontSize: 30, color: '#94a3b8' }}>
          Учи навыки как RPG-персонаж: деревья, прогресс, достижения
        </div>
      </div>
    ),
    { ...size }
  )
}

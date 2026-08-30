import { cn } from '@/shared/lib/utils'

/**
 * Логотип SkilLet — экслибрис: владельческий знак на переплёте.
 * Двойная рамка с чуть «неровной», отпечатанной геометрией и литерой S
 * в антикве. Сознательно не игровой герб и не буква в цветном квадрате.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('h-8 w-8', className)}
      role="img"
      aria-label="Логотип SkilLet"
    >
      {/* Внешняя рамка — чуть скруглённая, как оттиск на бумаге */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="3"
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="1.5"
      />
      {/* Внутренняя рубчатая рамка экслибриса */}
      <rect
        x="4.5"
        y="4.5"
        width="23"
        height="23"
        rx="1.5"
        fill="none"
        stroke="hsl(var(--foreground))"
        strokeWidth="0.75"
        opacity="0.7"
      />
      <text
        x="16"
        y="22.5"
        textAnchor="middle"
        fontFamily="var(--font-geist-sans), sans-serif"
        fontWeight="600"
        fontSize="17"
        fill="hsl(var(--accent-strong))"
      >
        S
      </text>
    </svg>
  )
}

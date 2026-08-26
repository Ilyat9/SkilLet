'use client'

import {
  ButtonHTMLAttributes,
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  type MutableRefObject,
} from 'react'
import { cn } from '@/shared/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  /**
   * Slot-паттерн (аналог Radix `asChild`): рендерит переданного child
   * (например, <Link/>) вместо <button>, мерджуя className/ref/onClick.
   */
  asChild?: boolean
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue
      if (typeof ref === 'function') {
        ref(node)
      } else {
        ;(ref as MutableRefObject<T | null>).current = node
      }
    }
  }
}

function buttonClasses(variant: string, size: string, className?: string): string {
  return cn(
    'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
    {
      'bg-primary text-primary-foreground hover:bg-primary/90': variant === 'primary',
      'bg-secondary text-secondary-foreground hover:bg-secondary/90': variant === 'secondary',
      'hover:bg-gray-700': variant === 'ghost',
    },
    {
      'h-9 px-4 py-2 text-sm': size === 'sm',
      'h-10 px-6 py-2': size === 'md',
      'h-12 px-8 py-3 text-base': size === 'lg',
    },
    className
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, children, onClick, ...props }, ref) => {
    const classes = buttonClasses(variant, size, className)

    if (asChild && isValidElement(children)) {
      const child = children as ReactElement<{
        className?: string
        onClick?: (event: React.MouseEvent<HTMLElement>) => void
        ref?: Ref<HTMLElement>
      }>
      const childProps = child.props

      return cloneElement(child as ReactElement<Record<string, unknown>>, {
        className: cn(classes, childProps.className),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          childProps.onClick?.(event)
          onClick?.(event as React.MouseEvent<HTMLButtonElement>)
        },
        ref: mergeRefs(ref as unknown as Ref<HTMLElement> | undefined, childProps.ref),
      })
    }

    return (
      <button
        ref={ref}
        className={classes}
        onClick={onClick}
        {...props}
      >
        {children as ReactNode}
      </button>
    )
  }
)

Button.displayName = 'Button'

// Экспортируем для удобства типизированной проверки «есть ли среди детей элемент»
export function hasSingleChild(children: ReactNode): boolean {
  return Children.count(children) === 1
}

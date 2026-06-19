import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'default' | 'accent' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  default: 'bg-[#18181b] text-[#fafafa] border border-[rgba(255,255,255,0.07)] hover:bg-[#27272a]',
  accent: 'bg-[#22c55e] text-[#09090b] hover:bg-[#16a34a] font-medium',
  danger: 'bg-[#ef4444] text-white hover:bg-[#dc2626] font-medium',
  ghost: 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', loading, className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-2 rounded-[8px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

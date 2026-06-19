import type { ReactNode } from 'react'

type BadgeVariant = 'green' | 'blue' | 'purple' | 'red' | 'amber' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  green: 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20',
  blue: 'bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/20',
  purple: 'bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20',
  red: 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20',
  amber: 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20',
  gray: 'bg-[#27272a] text-[#a1a1aa] border border-[rgba(255,255,255,0.07)]',
}

export function Badge({ variant = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

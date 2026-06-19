import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  accentColor?: string
  onClick?: () => void
}

export function Card({ children, className = '', accentColor, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[12px] overflow-hidden ${onClick ? 'cursor-pointer hover:bg-[#18181b] transition-colors' : ''} ${className}`}
    >
      {accentColor && (
        <div className="h-[3px] w-full" style={{ backgroundColor: accentColor }} />
      )}
      {children}
    </div>
  )
}

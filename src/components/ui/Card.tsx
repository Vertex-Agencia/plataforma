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
      className={`relative bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-card overflow-hidden ${onClick ? 'cursor-pointer hover:border-[rgba(255,255,255,0.14)] transition-colors' : ''} ${className}`}
    >
      {accentColor && (
        <div
          className="absolute top-0 left-0 w-3.5 h-3.5"
          style={{ backgroundColor: accentColor, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
      )}
      {children}
    </div>
  )
}

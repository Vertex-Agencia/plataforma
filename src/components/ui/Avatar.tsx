import { getInitials, avatarColor } from '../../utils/format'

interface AvatarProps {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  const color = avatarColor(name)
  const initials = getInitials(name)
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${sizes[size]} ${className}`}
      style={{ backgroundColor: color + '20', color, border: `1px solid ${color}30` }}
    >
      {initials}
    </div>
  )
}

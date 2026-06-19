import type { ReactNode } from 'react'
import { InboxIcon } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title = 'Nenhum resultado', description, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
      <div className="text-[#52525b]">
        {icon ?? <InboxIcon size={40} strokeWidth={1} />}
      </div>
      <p className="text-[#fafafa] font-medium">{title}</p>
      {description && <p className="text-[#a1a1aa] text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  actions?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, children, actions, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-[#111113] border border-[rgba(255,255,255,0.07)] rounded-[12px] shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-[rgba(255,255,255,0.07)] shrink-0">
          <h2 className="text-base font-semibold text-[#fafafa]">{title}</h2>
          <button onClick={onClose} className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors p-1 rounded-[6px] hover:bg-[#27272a]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">{children}</div>
        {actions && (
          <div className="flex justify-end gap-2 p-5 border-t border-[rgba(255,255,255,0.07)] shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

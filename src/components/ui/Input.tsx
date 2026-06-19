import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

const baseClass = 'w-full bg-[#18181b] border border-[rgba(255,255,255,0.07)] rounded-[8px] px-3 py-2 text-[#fafafa] text-sm placeholder-[#52525b] focus:outline-none focus:border-[#3b82f6] transition-colors'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-[#a1a1aa]">{label}</label>}
      <input ref={ref} className={`${baseClass} ${error ? 'border-[#ef4444]' : ''} ${className}`} {...props} />
      {error && <span className="text-xs text-[#ef4444]">{error}</span>}
    </div>
  )
)
Input.displayName = 'Input'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-[#a1a1aa]">{label}</label>}
      <textarea ref={ref} className={`${baseClass} resize-none ${error ? 'border-[#ef4444]' : ''} ${className}`} {...props} />
      {error && <span className="text-xs text-[#ef4444]">{error}</span>}
    </div>
  )
)
Textarea.displayName = 'Textarea'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  children: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', children, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-[#a1a1aa]">{label}</label>}
      <select ref={ref} className={`${baseClass} cursor-pointer ${error ? 'border-[#ef4444]' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <span className="text-xs text-[#ef4444]">{error}</span>}
    </div>
  )
)
Select.displayName = 'Select'

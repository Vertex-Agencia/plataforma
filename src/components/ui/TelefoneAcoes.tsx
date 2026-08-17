import { useState } from 'react'
import { Phone, Copy, Check } from 'lucide-react'
import { pareceCelularBrasileiro, linkWhatsapp } from '../../utils/format'

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.79.47 3.53 1.36 5.07L2 22l5.24-1.45a9.9 9.9 0 0 0 4.8 1.22h.01c5.46 0 9.9-4.45 9.9-9.91C22 6.45 17.5 2 12.04 2Zm5.82 14.15c-.25.7-1.25 1.29-1.98 1.44-.51.11-1.17.19-3.4-.72-2.85-1.18-4.68-4.07-4.82-4.26-.14-.19-1.16-1.54-1.16-2.93 0-1.4.73-2.08 1-2.36.25-.28.55-.35.73-.35h.53c.17 0 .4-.03.62.48.25.6.85 2.08.92 2.23.07.15.12.33.02.53-.1.2-.15.33-.3.5-.14.18-.3.4-.43.53-.14.15-.29.3-.13.6.16.3.72 1.2 1.55 1.95 1.07.96 1.96 1.26 2.26 1.4.3.15.48.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.24.67-.14.28.1 1.75.83 2.05.98.3.15.5.22.58.35.07.13.07.75-.18 1.45Z" />
    </svg>
  )
}

interface TelefoneAcoesProps {
  telefone: string
  className?: string
}

export function TelefoneAcoes({ telefone, className = '' }: TelefoneAcoesProps) {
  const [copiado, setCopiado] = useState(false)
  const ehCelular = pareceCelularBrasileiro(telefone)

  async function copiar(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(telefone)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Clipboard indisponível (ex: contexto não seguro) — sem crash, só não copia.
    }
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-[#fafafa] bg-[#18181b] rounded-[8px] px-3 py-2 ${className}`}>
      <Phone size={14} className="text-[#71717a] shrink-0" />
      <span className="flex-1 truncate">{telefone}</span>

      <button
        onClick={copiar}
        title={copiado ? 'Copiado!' : 'Copiar telefone'}
        className="shrink-0 p-1 rounded-[6px] text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
      >
        {copiado ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
      </button>

      {ehCelular && (
        <a
          href={linkWhatsapp(telefone)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Abrir no WhatsApp"
          className="shrink-0 p-1 rounded-[6px] text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
        >
          <WhatsAppIcon />
        </a>
      )}
    </div>
  )
}

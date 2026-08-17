import { useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { formatDate } from '../../utils/format'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/leads': 'Leads',
  '/leads/buscar': 'Buscar Leads',
  '/financeiro': 'Financeiro',
  '/projetos': 'Projetos',
  '/reunioes': 'Reuniões',
  '/estudo': 'Área de Estudo',
  '/configuracoes': 'Configurações',
}

function getTitle(pathname: string): string {
  if (pathname.startsWith('/clientes/')) return 'Perfil do Cliente'
  if (pathname.startsWith('/projetos/')) return 'Projeto'
  return titles[pathname] ?? 'Vertex'
}

interface TopbarProps {
  onOpenMobile: () => void
}

export function Topbar({ onOpenMobile }: TopbarProps) {
  const { pathname } = useLocation()
  const title = getTitle(pathname)
  const today = formatDate(new Date().toISOString().split('T')[0])

  return (
    <header className="h-14 flex items-center justify-between gap-3 px-4 lg:px-6 border-b border-[rgba(255,255,255,0.07)] bg-[#09090b]/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobile}
          className="lg:hidden shrink-0 p-1.5 -ml-1.5 rounded-[8px] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors"
          aria-label="Abrir menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="font-display text-base font-semibold text-[#fafafa] tracking-tight truncate">{title}</h1>
      </div>
      <span className="font-mono text-xs text-[#a1a1aa] tabular-nums shrink-0">{today}</span>
    </header>
  )
}

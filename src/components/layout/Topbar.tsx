import { useLocation } from 'react-router-dom'
import { formatDate } from '../../utils/format'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
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

export function Topbar() {
  const { pathname } = useLocation()
  const title = getTitle(pathname)
  const today = formatDate(new Date().toISOString().split('T')[0])

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-[rgba(255,255,255,0.07)] bg-[#09090b]/80 backdrop-blur-sm sticky top-0 z-30">
      <h1 className="text-base font-semibold text-[#fafafa]">{title}</h1>
      <span className="text-sm text-[#a1a1aa]">{today}</span>
    </header>
  )
}

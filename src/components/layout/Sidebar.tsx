import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Wallet,
  FolderKanban,
  CalendarClock,
  BookOpen,
  Settings,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/financeiro', icon: Wallet, label: 'Financeiro' },
  { to: '/projetos', icon: FolderKanban, label: 'Projetos' },
  { to: '/reunioes', icon: CalendarClock, label: 'Reuniões' },
  { to: '/estudo', icon: BookOpen, label: 'Área de Estudo' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuthStore()
  const logoUrl: string | null = user?.user_metadata?.logo_url ?? null

  return (
    <aside
      className="fixed top-0 left-0 h-screen bg-[#111113] border-r border-[rgba(255,255,255,0.07)] flex flex-col z-40 transition-all duration-300"
      style={{ width: collapsed ? '56px' : '224px' }}
    >
      {/* Logo */}
      <div className="px-3 pt-4 pb-3 border-b border-[rgba(255,255,255,0.07)] flex items-center gap-2.5 min-h-[56px]">
        <div className="w-8 h-8 rounded-[8px] bg-[#22c55e] flex items-center justify-center shrink-0 overflow-hidden">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-0.5" />
          ) : (
            <Zap size={16} className="text-[#09090b]" fill="currentColor" />
          )}
        </div>

        {!collapsed && (
          <>
            <span className="font-semibold text-[#fafafa] text-base tracking-tight whitespace-nowrap">Vertex</span>
            <div className="ml-auto flex items-center gap-1.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-2 py-0.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]" />
              </span>
              <span className="text-[#22c55e] text-[10px] font-semibold tracking-wider">LIVE</span>
            </div>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm transition-colors ${
                collapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-[#22c55e]/10 text-[#22c55e]'
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
              }`
            }
          >
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer: settings + toggle */}
      <div className="px-2 pb-3 border-t border-[rgba(255,255,255,0.07)] pt-3 flex flex-col gap-1">
        <NavLink
          to="/configuracoes"
          title={collapsed ? 'Configurações' : undefined}
          className={({ isActive }) =>
            `flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm transition-colors ${
              collapsed ? 'justify-center' : ''
            } ${
              isActive
                ? 'bg-[#22c55e]/10 text-[#22c55e]'
                : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
            }`
          }
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed && <span className="whitespace-nowrap">Configurações</span>}
        </NavLink>

        <button
          onClick={onToggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={`flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b] transition-colors ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight size={16} className="shrink-0" /> : <ChevronLeft size={16} className="shrink-0" />}
          {!collapsed && <span className="whitespace-nowrap">Recolher</span>}
        </button>
      </div>
    </aside>
  )
}

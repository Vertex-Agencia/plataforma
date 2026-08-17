import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Target,
  KanbanSquare,
  Radar,
  Wallet,
  FolderKanban,
  CalendarClock,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LogOut,
  X,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { Avatar } from '../ui/Avatar'

interface NavLeaf {
  to: string
  icon: ComponentType<{ size?: number; className?: string }>
  label: string
}

interface NavItem extends NavLeaf {
  children?: NavLeaf[]
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'Geral',
    items: [{ to: '/', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Comercial',
    items: [
      {
        to: '/leads',
        icon: Target,
        label: 'Leads',
        children: [
          { to: '/leads', icon: KanbanSquare, label: 'Pipeline' },
          { to: '/leads/buscar', icon: Radar, label: 'Buscar Leads' },
        ],
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/clientes', icon: Users, label: 'Clientes' },
      { to: '/financeiro', icon: Wallet, label: 'Financeiro' },
      { to: '/projetos', icon: FolderKanban, label: 'Projetos' },
      { to: '/reunioes', icon: CalendarClock, label: 'Reuniões' },
    ],
  },
  {
    label: 'Recursos',
    items: [{ to: '/estudo', icon: BookOpen, label: 'Área de Estudo' }],
  },
]

const navItems: NavItem[] = navSections.flatMap((s) => s.items)

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const navLinkClass = (collapsed: boolean, isActive: boolean) =>
  `relative flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm transition-colors ${
    collapsed ? 'justify-center' : ''
  } ${isActive ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'}`

export function Sidebar({ collapsed, onToggle, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const logoUrl: string | null = user?.user_metadata?.logo_url ?? null

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(navItems.filter((i) => i.children?.some((c) => c.to === pathname)).map((i) => i.to))
  )
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  // Fecha o drawer mobile automaticamente ao trocar de rota.
  useEffect(() => { onCloseMobile() }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function toggleGroup(to: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(to)) next.delete(to)
      else next.add(to)
      return next
    })
  }

  async function handleSignOut() {
    setAccountOpen(false)
    await supabase.auth.signOut()
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen bg-[#111113] border-r border-[rgba(255,255,255,0.07)] flex flex-col z-40 transition-all duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ width: collapsed ? '56px' : '224px' }}
      >
        {/* Logo */}
        <div className={`border-b border-[rgba(255,255,255,0.07)] flex items-center min-h-[56px] ${collapsed ? 'justify-center px-1' : 'px-3 gap-2.5'}`}>
          <img
            src={collapsed ? (logoUrl ?? '/vertex-mark.png') : (logoUrl ?? '/vertex-logo.png')}
            alt="Vertex"
            className={`object-contain shrink-0 ${collapsed ? 'h-8 w-8' : 'h-8 w-auto max-w-[130px]'}`}
          />

          {!collapsed && (
            <div className="ml-auto flex items-center gap-1.5 bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-full px-2 py-0.5 shrink-0">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]" />
              </span>
              <span className="text-[#22c55e] text-[10px] font-semibold tracking-wider">LIVE</span>
            </div>
          )}

          <button
            onClick={onCloseMobile}
            className="lg:hidden ml-2 p-1 rounded-[6px] text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors shrink-0"
            aria-label="Fechar menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 flex flex-col gap-3 overflow-y-auto overflow-x-hidden">
          {navSections.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              {!collapsed && (
                <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#52525b]">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <NavEntry
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  isOpen={openGroups.has(item.to)}
                  onToggleGroup={toggleGroup}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Conta */}
        <div ref={accountRef} className="relative px-2 pt-2 border-t border-[rgba(255,255,255,0.07)]">
          {accountOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1.5 bg-[#18181b] border border-[rgba(255,255,255,0.1)] rounded-[10px] shadow-lg overflow-hidden">
              <div className="px-3 py-2.5 border-b border-[rgba(255,255,255,0.07)]">
                <p className="text-xs text-[#a1a1aa] truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setAccountOpen(false); navigate('/configuracoes') }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#27272a] transition-colors"
              >
                <Settings size={14} /> Configurações
              </button>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          )}

          <button
            onClick={() => setAccountOpen((v) => !v)}
            className={`w-full flex items-center gap-2.5 py-2 rounded-[8px] text-sm text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors ${
              collapsed ? 'justify-center px-0' : 'px-1.5'
            }`}
          >
            <Avatar name={user?.email ?? 'U'} size="sm" />
            {!collapsed && (
              <>
                <span className="flex-1 min-w-0 truncate text-left">{user?.email}</span>
                <ChevronUp size={14} className={`shrink-0 transition-transform ${accountOpen ? '' : 'rotate-180'}`} />
              </>
            )}
          </button>
        </div>

        {/* Recolher */}
        <div className="px-2 pb-3 pt-1 hidden lg:block">
          <button
            onClick={onToggle}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm text-[#52525b] hover:text-[#a1a1aa] hover:bg-[#18181b] transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <ChevronRight size={16} className="shrink-0" /> : <ChevronLeft size={16} className="shrink-0" />}
            {!collapsed && <span className="whitespace-nowrap">Recolher</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

interface NavEntryProps {
  item: NavItem
  collapsed: boolean
  isOpen: boolean
  onToggleGroup: (to: string) => void
}

function NavEntry({ item, collapsed, isOpen, onToggleGroup }: NavEntryProps) {
  const { pathname } = useLocation()
  const Icon = item.icon
  const hasChildren = !!item.children?.length

  // Sem espaço pra acordeão no modo minificado — o item pai vira link direto.
  if (!hasChildren || collapsed) {
    return (
      <NavLink
        to={item.to}
        end={item.to === '/'}
        title={collapsed ? item.label : undefined}
        className={({ isActive }) => navLinkClass(collapsed, isActive)}
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute left-[-8px] top-1/2 -translate-y-1/2 h-4 w-[2px] bg-[#22c55e] rounded-full" />}
            <Icon size={16} className="shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </>
        )}
      </NavLink>
    )
  }

  const groupActive = item.children!.some((c) => c.to === pathname)

  return (
    <div>
      <button
        onClick={() => onToggleGroup(item.to)}
        className={`w-full text-left flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-sm transition-colors ${
          groupActive ? 'text-[#fafafa]' : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="whitespace-nowrap flex-1">{item.label}</span>
        {isOpen ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <ul className="overflow-hidden pl-7 flex flex-col gap-0.5 pt-0.5">
          {item.children!.map((child) => (
            <li key={child.to}>
              <NavLink
                to={child.to}
                end
                className={({ isActive }) =>
                  `block px-2.5 py-1.5 rounded-[8px] text-sm transition-colors ${
                    isActive ? 'text-[#22c55e]' : 'text-[#71717a] hover:text-[#fafafa] hover:bg-[#18181b]'
                  }`
                }
              >
                {child.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

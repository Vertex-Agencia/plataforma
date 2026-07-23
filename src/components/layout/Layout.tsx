import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { ErrorBoundary } from '../ErrorBoundary'

function getSavedCollapsed(): boolean {
  try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(getSavedCollapsed)

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }

  const sidebarWidth = collapsed ? 56 : 224

  return (
    <div className="flex min-h-screen bg-[#09090b] overflow-x-hidden">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div
        className="flex flex-col min-h-screen transition-all duration-300 overflow-x-hidden"
        style={{ marginLeft: sidebarWidth, width: `calc(100vw - ${sidebarWidth}px)` }}
      >
        <Topbar />
        <main className="flex-1 p-6 min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

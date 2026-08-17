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
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }

  return (
    <div className="flex min-h-screen bg-[#09090b] overflow-x-hidden">
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div
        className="content-shift flex flex-col min-h-screen w-full transition-[margin,width] duration-300 overflow-x-hidden"
        style={{ '--sidebar-w': collapsed ? '56px' : '224px' } as React.CSSProperties}
      >
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6 min-w-0 overflow-x-hidden">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

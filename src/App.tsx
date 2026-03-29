import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Moon, Clock, LayoutDashboard, Users, Tag, FileText, Receipt, Settings } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import TimeEntry from './pages/TimeEntry'
import Entries from './pages/Entries'
import Clients from './pages/Clients'
import Tickets from './pages/Tickets'
import InvoicesPage from './pages/Invoices'
import SettingsPage from './pages/Settings'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/erfassen', icon: Clock, label: 'Erfassen' },
  { to: '/buchungen', icon: FileText, label: 'Buchungen' },
  { to: '/tickets', icon: Tag, label: 'Tickets' },
  { to: '/kunden', icon: Users, label: 'Kunden' },
  { to: '/abrechnungen', icon: Receipt, label: 'Abrechnungen' },
  { to: '/einstellungen', icon: Settings, label: 'Einstellungen' },
]

export default function App() {
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-night-900 border-r border-night-700/50 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-loona-300 to-loona-600 flex items-center justify-center">
            <Moon size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Loona</h1>
            <p className="text-xs text-night-300">Zeiterfassung</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to))
            const isExactHome = item.to === '/' && location.pathname === '/'
            const active = item.to === '/' ? isExactHome : isActive

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-loona ${
                  active
                    ? 'bg-loona-600/20 text-loona-200 loona-glow'
                    : 'text-night-300 hover:text-white hover:bg-night-800'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-night-700/50">
          <p className="text-xs text-night-400 text-center">Loona v1.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-night-950">
        <div className="max-w-6xl mx-auto p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/erfassen" element={<TimeEntry />} />
            <Route path="/buchungen" element={<Entries />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/kunden" element={<Clients />} />
            <Route path="/abrechnungen" element={<InvoicesPage />} />
            <Route path="/einstellungen" element={<SettingsPage />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

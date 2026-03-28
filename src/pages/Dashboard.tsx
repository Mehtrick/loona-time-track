import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Users, Tag, TrendingUp, ArrowRight } from 'lucide-react'
import { api } from '../api'
import type { ClientSummary, TimeEntry } from '../types'

export default function Dashboard() {
  const [summary, setSummary] = useState<ClientSummary[]>([])
  const [recentEntries, setRecentEntries] = useState<TimeEntry[]>([])
  const [totalOpen, setTotalOpen] = useState(0)

  useEffect(() => {
    api.getSummary().then(data => {
      setSummary(data)
      setTotalOpen(data.reduce((sum: number, c: ClientSummary) => sum + c.total_hours, 0))
    })
    api.getEntries().then(entries => setRecentEntries(entries.slice(0, 8)))
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-night-300 mt-1">Überblick deiner offenen Stunden</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-night-900 rounded-2xl p-6 border border-night-700/50 luna-glow">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-luna-600/20 flex items-center justify-center">
              <Clock size={20} className="text-luna-300" />
            </div>
            <span className="text-night-300 text-sm">Offene Stunden</span>
          </div>
          <p className="text-3xl font-bold text-white">{totalOpen.toFixed(1)}h</p>
        </div>

        <div className="bg-night-900 rounded-2xl p-6 border border-night-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
              <Users size={20} className="text-emerald-400" />
            </div>
            <span className="text-night-300 text-sm">Kunden</span>
          </div>
          <p className="text-3xl font-bold text-white">{summary.length}</p>
        </div>

        <div className="bg-night-900 rounded-2xl p-6 border border-night-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 flex items-center justify-center">
              <TrendingUp size={20} className="text-amber-400" />
            </div>
            <span className="text-night-300 text-sm">Offene Buchungen</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {summary.reduce((sum, c) => sum + c.entry_count, 0)}
          </p>
        </div>
      </div>

      {/* Per-Client Breakdown */}
      {summary.length > 0 && (
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Offene Stunden pro Kunde</h3>
          <div className="space-y-3">
            {summary.map(client => (
              <div key={client.client_id} className="flex items-center gap-4">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: client.client_color }}
                />
                <span className="text-sm text-night-200 w-40 truncate">{client.client_name}</span>
                <div className="flex-1 bg-night-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${totalOpen ? (client.total_hours / totalOpen) * 100 : 0}%`,
                      backgroundColor: client.client_color,
                    }}
                  />
                </div>
                <span className="text-sm font-medium text-white w-20 text-right">
                  {client.total_hours.toFixed(1)}h
                </span>
                <span className="text-xs text-night-400 w-24 text-right">
                  {client.entry_count} Buchung{client.entry_count !== 1 ? 'en' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent entries */}
      <div className="bg-night-900 rounded-2xl border border-night-700/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Letzte Buchungen</h3>
          <Link
            to="/buchungen"
            className="text-sm text-luna-300 hover:text-luna-200 flex items-center gap-1 transition-luna"
          >
            Alle anzeigen <ArrowRight size={14} />
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={48} className="mx-auto text-night-600 mb-4" />
            <p className="text-night-400">Noch keine Buchungen vorhanden</p>
            <Link
              to="/erfassen"
              className="inline-block mt-4 px-4 py-2 bg-luna-600 hover:bg-luna-500 text-white rounded-lg text-sm transition-luna"
            >
              Erste Stunden erfassen
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-night-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Datum</th>
                  <th className="pb-3 pr-4">Kunde</th>
                  <th className="pb-3 pr-4">Ticket</th>
                  <th className="pb-3 pr-4">Beschreibung</th>
                  <th className="pb-3 text-right">Stunden</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800">
                {recentEntries.map(entry => (
                  <tr key={entry.id} className="text-sm">
                    <td className="py-3 pr-4 text-night-200">{formatDate(entry.date)}</td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: entry.client_color }}
                        />
                        <span className="text-night-200">{entry.client_name}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {entry.ticket_reference ? (
                        <span className="px-2 py-0.5 bg-night-800 rounded text-xs text-night-200">
                          {entry.ticket_reference}
                        </span>
                      ) : (
                        <span className="text-night-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-night-300 max-w-xs truncate">{entry.description}</td>
                    <td className="py-3 text-right font-medium text-white">{entry.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Empty state for new users */}
      {summary.length === 0 && (
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-luna-300 to-luna-600 flex items-center justify-center mx-auto mb-6">
            <Tag size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Willkommen bei Luna!</h3>
          <p className="text-night-300 mb-6 max-w-md mx-auto">
            Starte damit, deinen ersten Kunden anzulegen. Danach kannst du Tickets erstellen und Stunden buchen.
          </p>
          <Link
            to="/kunden"
            className="inline-block px-6 py-3 bg-luna-600 hover:bg-luna-500 text-white rounded-xl font-medium transition-luna luna-glow-hover"
          >
            Ersten Kunden anlegen
          </Link>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

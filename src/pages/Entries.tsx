import { useEffect, useState } from 'react'
import { FileText, Filter, Receipt, Trash2, Eye, EyeOff, X, CheckSquare, Square } from 'lucide-react'
import { api } from '../api'
import type { Client, TimeEntry } from '../types'

export default function Entries() {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState<number | ''>('')
  const [showBilled, setShowBilled] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [billingEntry, setBillingEntry] = useState<number | null>(null)
  const [billingText, setBillingText] = useState('')

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [batchBillingText, setBatchBillingText] = useState('')
  const [showBatchBilling, setShowBatchBilling] = useState(false)

  function loadEntries() {
    api.getEntries({
      client_id: filterClient || undefined,
      show_billed: showBilled,
      from: filterFrom || undefined,
      to: filterTo || undefined,
    }).then(data => {
      setEntries(data)
      setSelectedIds(new Set())
      setShowBatchBilling(false)
      setBatchBillingText('')
    })
  }

  useEffect(() => {
    api.getClients().then(setClients)
  }, [])

  useEffect(() => {
    loadEntries()
  }, [filterClient, showBilled, filterFrom, filterTo])

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const unbilledEntries = entries.filter(e => !e.billed)
  const selectedHours = entries.filter(e => selectedIds.has(e.id)).reduce((sum, e) => sum + e.hours, 0)

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === unbilledEntries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(unbilledEntries.map(e => e.id)))
    }
  }

  async function handleBill(entryId: number) {
    if (!billingText.trim()) return
    await api.updateEntry(entryId, {
      ...entries.find(e => e.id === entryId),
      billed: billingText,
    })
    setBillingEntry(null)
    setBillingText('')
    loadEntries()
  }

  async function handleBatchBill() {
    if (!batchBillingText.trim() || selectedIds.size === 0) return
    const promises = Array.from(selectedIds).map(id => {
      const entry = entries.find(e => e.id === id)
      if (entry) return api.updateEntry(id, { ...entry, billed: batchBillingText })
    })
    await Promise.all(promises)
    setShowBatchBilling(false)
    setBatchBillingText('')
    setSelectedIds(new Set())
    loadEntries()
  }

  async function handleDelete(id: number) {
    if (!confirm('Buchung wirklich löschen?')) return
    await api.deleteEntry(id)
    loadEntries()
  }

  async function handleUnbill(entry: TimeEntry) {
    await api.updateEntry(entry.id, { ...entry, billed: '' })
    loadEntries()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Buchungen</h2>
          <p className="text-night-300 mt-1">
            {showBilled ? 'Alle' : 'Offene'} Buchungen verwalten und abrechnen
          </p>
        </div>
        <div className="bg-night-900 border border-night-700/50 rounded-xl px-4 py-2">
          <span className="text-night-400 text-sm">Gesamt: </span>
          <span className="text-white font-bold">{totalHours.toFixed(1)}h</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-night-900 rounded-2xl border border-night-700/50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-night-400" />
          <span className="text-sm font-medium text-night-300">Filter</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value ? Number(e.target.value) : '')}
            className="bg-night-800 border border-night-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-loona-500"
          >
            <option value="">Alle Kunden</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            placeholder="Von"
            className="bg-night-800 border border-night-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-loona-500"
          />
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            placeholder="Bis"
            className="bg-night-800 border border-night-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-loona-500"
          />

          <button
            onClick={() => setShowBilled(!showBilled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-loona border ${
              showBilled
                ? 'border-loona-500 bg-loona-600/20 text-loona-200'
                : 'border-night-600/50 bg-night-800 text-night-400 hover:text-white'
            }`}
          >
            {showBilled ? <Eye size={14} /> : <EyeOff size={14} />}
            {showBilled ? 'Abgerechnete anzeigen' : 'Abgerechnete ausgeblendet'}
          </button>

          {(filterClient || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterClient(''); setFilterFrom(''); setFilterTo('') }}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-night-400 hover:text-white border border-night-600/50 bg-night-800 transition-loona"
            >
              <X size={14} /> Zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Batch billing bar */}
      {selectedIds.size > 0 && (
        <div className="bg-loona-600/10 border border-loona-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-loona-200 text-sm font-medium">
              {selectedIds.size} Buchung{selectedIds.size !== 1 ? 'en' : ''} ausgewählt
            </span>
            <span className="text-night-400 text-sm">({selectedHours.toFixed(1)}h)</span>
          </div>
          {showBatchBilling ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={batchBillingText}
                onChange={e => setBatchBillingText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleBatchBill()}
                placeholder="z.B. Rechnung #2024-03"
                className="bg-night-800 border border-night-600/50 rounded-lg px-3 py-2 text-sm text-white w-64 focus:outline-none focus:border-loona-500"
                autoFocus
              />
              <button
                onClick={handleBatchBill}
                disabled={!batchBillingText.trim()}
                className="flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-loona"
              >
                <Receipt size={14} />
                Alle abrechnen
              </button>
              <button
                onClick={() => { setShowBatchBilling(false); setBatchBillingText('') }}
                className="p-2 rounded-lg text-night-400 hover:text-white transition-loona"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBatchBilling(true)}
                className="flex items-center gap-2 px-4 py-2 bg-loona-600 hover:bg-loona-500 text-white rounded-lg text-sm font-medium transition-loona"
              >
                <Receipt size={14} />
                Auswahl abrechnen
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-2 text-night-400 hover:text-white text-sm transition-loona"
              >
                Auswahl aufheben
              </button>
            </div>
          )}
        </div>
      )}

      {/* Entries Table */}
      <div className="bg-night-900 rounded-2xl border border-night-700/50 overflow-hidden">
        {entries.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={48} className="mx-auto text-night-600 mb-4" />
            <p className="text-night-400">
              {showBilled ? 'Keine Buchungen gefunden' : 'Keine offenen Buchungen'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-night-400 uppercase tracking-wider border-b border-night-800">
                  <th className="px-4 py-4 w-10">
                    {unbilledEntries.length > 0 && (
                      <button onClick={toggleSelectAll} className="text-night-400 hover:text-loona-300 transition-loona">
                        {selectedIds.size === unbilledEntries.length && unbilledEntries.length > 0
                          ? <CheckSquare size={16} />
                          : <Square size={16} />
                        }
                      </button>
                    )}
                  </th>
                  <th className="px-4 py-4">Datum</th>
                  <th className="px-4 py-4">Kunde</th>
                  <th className="px-4 py-4">Ticket</th>
                  <th className="px-4 py-4">Beschreibung</th>
                  <th className="px-4 py-4 text-right">Stunden</th>
                  <th className="px-4 py-4 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-night-800/50">
                {entries.map(entry => (
                  <tr
                    key={entry.id}
                    className={`hover:bg-night-800/30 transition-loona group ${
                      selectedIds.has(entry.id) ? 'bg-loona-600/5' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      {!entry.billed && (
                        <button
                          onClick={() => toggleSelect(entry.id)}
                          className={`transition-loona ${
                            selectedIds.has(entry.id)
                              ? 'text-loona-300'
                              : 'text-night-600 hover:text-night-400'
                          }`}
                        >
                          {selectedIds.has(entry.id)
                            ? <CheckSquare size={16} />
                            : <Square size={16} />
                          }
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-night-200">{formatDate(entry.date)}</td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2 text-sm">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.client_color }}
                        />
                        <span className="text-night-200">{entry.client_name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {entry.ticket_reference ? (
                        <span className="px-2 py-0.5 bg-night-800 rounded text-xs text-night-200">
                          {entry.ticket_reference}
                        </span>
                      ) : (
                        <span className="text-night-600 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-night-300 max-w-xs truncate">{entry.description}</td>
                    <td className="px-4 py-4 text-sm font-medium text-white text-right">{entry.hours}h</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {entry.billed ? (
                          <button
                            onClick={() => handleUnbill(entry)}
                            className="px-2 py-1 rounded text-xs bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 transition-loona"
                            title={`Abgerechnet: ${entry.billed}`}
                          >
                            ✓ {entry.billed.length > 20 ? entry.billed.slice(0, 20) + '...' : entry.billed}
                          </button>
                        ) : billingEntry === entry.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={billingText}
                              onChange={e => setBillingText(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleBill(entry.id)}
                              placeholder="z.B. Rechnung #2024-03"
                              className="bg-night-800 border border-night-600/50 rounded px-2 py-1 text-xs text-white w-48 focus:outline-none focus:border-loona-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleBill(entry.id)}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500 transition-loona"
                            >
                              <Receipt size={12} />
                            </button>
                            <button
                              onClick={() => { setBillingEntry(null); setBillingText('') }}
                              className="p-1 rounded bg-night-700 text-night-300 hover:text-white transition-loona"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => { setBillingEntry(entry.id); setBillingText('') }}
                              className="px-2 py-1 rounded text-xs bg-loona-600/20 text-loona-300 hover:bg-loona-600/30 transition-loona opacity-0 group-hover:opacity-100"
                            >
                              <Receipt size={12} className="inline mr-1" />
                              Abrechnen
                            </button>
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="p-1 rounded text-night-500 hover:text-red-400 transition-loona opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-night-700">
                  <td />
                  <td colSpan={4} className="px-4 py-4 text-sm font-medium text-night-300">
                    {entries.length} Buchung{entries.length !== 1 ? 'en' : ''}
                  </td>
                  <td className="px-4 py-4 text-sm font-bold text-white text-right">
                    {totalHours.toFixed(1)}h
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

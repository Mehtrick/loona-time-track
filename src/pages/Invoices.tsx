import { useEffect, useState } from 'react'
import { Receipt, Plus, Trash2, FileDown, FolderDown, X, Check } from 'lucide-react'
import { api, getPdfUrl, getDownloadAllUrl } from '../api'
import { useToast } from '../components/Toast'
import type { Client, Invoice, TimeEntry } from '../types'

const INPUT = "w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
const LABEL = "block text-sm font-medium text-night-200 mb-1.5"

function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
}

function fmtDate(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function Invoices() {
  const { toast } = useToast()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [showForm, setShowForm] = useState(false)

  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [paymentDays, setPaymentDays] = useState(14)
  const [hourlyRate, setHourlyRate] = useState(80)
  const [maxAmount, setMaxAmount] = useState<number | undefined>(undefined)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set())
  const [creating, setCreating] = useState(false)

  function load() {
    api.getInvoices().then(setInvoices).catch(() => toast('Fehler beim Laden der Rechnungen.', 'error'))
  }

  useEffect(() => { load() }, [])

  async function openForm() {
    try {
      const [cls, settings, next] = await Promise.all([
        api.getClients(),
        api.getSettings(),
        api.getNextInvoiceNumber(),
      ])
      setClients(cls)
      setInvoiceNumber(next.next)
      setHourlyRate(settings.hourly_rate ?? 80)
      setPaymentDays(settings.payment_terms_days ?? 14)
      setInvoiceDate(todayISO())
      setMaxAmount(undefined)
      setSelectedClientId(null)
      setEntries([])
      setSelectedEntryIds(new Set())
      setShowForm(true)
    } catch {
      toast('Fehler beim Laden der Formulardaten.', 'error')
    }
  }

  async function onClientChange(clientId: number) {
    setSelectedClientId(clientId)
    try {
      const ents = await api.getEntries({ client_id: clientId, show_billed: false })
      ents.sort((a: TimeEntry, b: TimeEntry) => a.date.localeCompare(b.date))
      setEntries(ents)
      autoSelect(ents, hourlyRate, maxAmount)
    } catch {
      toast('Fehler beim Laden der Buchungen.', 'error')
    }
  }

  // Greedy fill: skip entries that don't fit, try smaller ones — don't stop at first miss
  function autoSelect(ents: TimeEntry[], rate: number, max?: number) {
    const ids = new Set<number>()
    let sum = 0
    for (const e of ents) {
      const amount = e.hours * rate
      if (max !== undefined && max > 0 && sum + amount > max) continue // skip, don't stop
      ids.add(e.id)
      sum += amount
    }
    setSelectedEntryIds(ids)
  }

  function toggleEntry(id: number) {
    setSelectedEntryIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleMaxAmountChange(val: string) {
    const v = val ? Number(val) : undefined
    setMaxAmount(v)
    autoSelect(entries, hourlyRate, v)
  }

  function handleRateChange(val: string) {
    const r = val ? Number(val) : 0
    setHourlyRate(r)
    autoSelect(entries, r, maxAmount)
  }

  const selectedTotal = entries
    .filter(e => selectedEntryIds.has(e.id))
    .reduce((sum, e) => sum + e.hours * hourlyRate, 0)

  const selectedHours = entries
    .filter(e => selectedEntryIds.has(e.id))
    .reduce((sum, e) => sum + e.hours, 0)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClientId || selectedEntryIds.size === 0 || !invoiceNumber.trim()) return
    setCreating(true)
    try {
      const dueDate = addDays(invoiceDate, paymentDays)
      await api.createInvoice({
        client_id: selectedClientId,
        invoice_number: invoiceNumber.trim(),
        date: invoiceDate,
        due_date: dueDate,
        hourly_rate: hourlyRate,
        entry_ids: Array.from(selectedEntryIds),
      })
      setShowForm(false)
      load()
      toast(`Rechnung ${invoiceNumber.trim()} wurde erstellt.`)
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('409') || msg.includes('existiert')) {
        toast('Diese Rechnungsnummer existiert bereits.', 'error')
      } else {
        toast('Fehler beim Erstellen der Rechnung.', 'error')
      }
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: number, invoiceNum: string) {
    if (!confirm('Rechnung löschen? Die zugehörigen Buchungen werden wieder als offen markiert.')) return
    try {
      await api.deleteInvoice(id)
      load()
      toast(`Rechnung ${invoiceNum} wurde gelöscht.`)
    } catch {
      toast('Fehler beim Löschen der Rechnung.', 'error')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Abrechnungen</h2>
          <p className="text-night-300 mt-1">Rechnungen erstellen und verwalten</p>
        </div>
        {!showForm && (
          <div className="flex items-center gap-2">
            {invoices.length > 0 && (
              <a
                href={getDownloadAllUrl()}
                download="Rechnungen.zip"
                className="flex items-center gap-2 px-4 py-2.5 bg-night-800 hover:bg-night-700 text-night-200 hover:text-white border border-night-600/50 rounded-xl text-sm font-medium transition-loona"
                title="Alle Rechnungen als ZIP herunterladen"
              >
                <FolderDown size={16} />
                Alle herunterladen
              </a>
            )}
            <button
              onClick={openForm}
              className="flex items-center gap-2 px-4 py-2.5 bg-loona-600 hover:bg-loona-500 text-white rounded-xl text-sm font-medium transition-loona loona-glow-hover"
            >
              <Plus size={16} />
              Neue Rechnung
            </button>
          </div>
        )}
      </div>

      {/* Create Invoice Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white">Neue Rechnung erstellen</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={LABEL}>Kunde</label>
              <select
                className={INPUT}
                value={selectedClientId ?? ''}
                onChange={e => e.target.value ? onClientChange(Number(e.target.value)) : setSelectedClientId(null)}
                required
              >
                <option value="">Kunde wählen...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Rechnungsnummer</label>
              <input
                className={INPUT}
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="z.B. 2026000001"
                required
              />
            </div>
            <div>
              <label className={LABEL}>Rechnungsdatum</label>
              <input className={INPUT} type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
            </div>
            <div>
              <label className={LABEL}>Zahlungsziel (Tage)</label>
              <input className={INPUT} type="number" min="0" value={paymentDays} onChange={e => setPaymentDays(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={LABEL}>Stundensatz (EUR)</label>
              <input className={INPUT} type="number" step="0.01" min="0" value={hourlyRate} onChange={e => handleRateChange(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Obergrenze (EUR, optional)</label>
              <input
                className={INPUT}
                type="number"
                step="0.01"
                min="0"
                value={maxAmount ?? ''}
                onChange={e => handleMaxAmountChange(e.target.value)}
                placeholder="Keine Obergrenze"
              />
            </div>
          </div>

          {/* Entry list */}
          {selectedClientId && entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={LABEL + ' mb-0'}>Offene Buchungen</label>
                <span className="text-xs text-night-400">
                  {selectedEntryIds.size} von {entries.length} ausgewählt
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-night-700/50">
                <table className="w-full text-sm">
                  <thead className="bg-night-800 sticky top-0">
                    <tr className="text-night-300">
                      <th className="w-10 px-3 py-2"></th>
                      <th className="text-left px-3 py-2">Datum</th>
                      <th className="text-left px-3 py-2">Ticket</th>
                      <th className="text-left px-3 py-2">Beschreibung</th>
                      <th className="text-right px-3 py-2">Stunden</th>
                      <th className="text-right px-3 py-2">Betrag</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-night-700/30">
                    {entries.map(entry => {
                      const amount = entry.hours * hourlyRate
                      const selected = selectedEntryIds.has(entry.id)
                      return (
                        <tr
                          key={entry.id}
                          onClick={() => toggleEntry(entry.id)}
                          className={`cursor-pointer transition-loona ${
                            selected ? 'bg-loona-600/10' : 'hover:bg-night-800/50'
                          }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleEntry(entry.id)}
                              className="rounded border-night-600 text-loona-500 focus:ring-loona-500 bg-night-800"
                            />
                          </td>
                          <td className="px-3 py-2 text-night-200 whitespace-nowrap">{fmtDate(entry.date)}</td>
                          <td className="px-3 py-2 text-night-300 font-mono text-xs">{entry.ticket_reference || '-'}</td>
                          <td className="px-3 py-2 text-white truncate max-w-xs">{entry.description || '-'}</td>
                          <td className="px-3 py-2 text-right text-night-200">{entry.hours.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-white font-medium">{fmtEur(amount)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="bg-night-800 rounded-xl px-6 py-3 text-right space-y-1">
                  <div className="text-night-300 text-sm">{selectedHours.toFixed(2)} Stunden x {fmtEur(hourlyRate)}</div>
                  <div className="text-xl font-bold text-white">{fmtEur(selectedTotal)}</div>
                  {maxAmount !== undefined && maxAmount > 0 && (
                    <div className="text-xs text-night-400">Obergrenze: {fmtEur(maxAmount)}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedClientId && entries.length === 0 && (
            <div className="text-center py-8 text-night-400">
              Keine offenen Buchungen für diesen Kunden vorhanden.
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !selectedClientId || selectedEntryIds.size === 0}
              className="flex items-center gap-2 px-6 py-3 bg-loona-600 hover:bg-loona-500 disabled:opacity-50 text-white rounded-xl font-medium transition-loona loona-glow-hover"
            >
              <Check size={16} />
              {creating ? 'Erstelle...' : 'Rechnung erstellen'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex items-center gap-2 px-6 py-3 bg-night-800 hover:bg-night-700 text-night-300 rounded-xl font-medium transition-loona"
            >
              <X size={16} />
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Invoice List */}
      {invoices.length === 0 && !showForm ? (
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-12 text-center">
          <Receipt size={48} className="mx-auto text-night-600 mb-4" />
          <p className="text-night-400 mb-4">Noch keine Rechnungen erstellt</p>
          <button
            onClick={openForm}
            className="px-4 py-2.5 bg-loona-600 hover:bg-loona-500 text-white rounded-xl text-sm font-medium transition-loona"
          >
            Erste Rechnung erstellen
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map(inv => (
            <div
              key={inv.id}
              className="bg-night-900 rounded-xl border border-night-700/50 px-6 py-4 flex items-center justify-between hover:bg-night-850 transition-loona"
            >
              <div className="flex items-center gap-4">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: inv.client_color || '#6b1ae6' }} />
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold font-mono">{inv.invoice_number}</span>
                    <span className="text-night-300">{inv.client_name}</span>
                  </div>
                  <div className="text-xs text-night-400 mt-0.5">
                    {fmtDate(inv.date)} · Fällig: {fmtDate(inv.due_date)} · {inv.items?.length || 0} Positionen
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-lg">{fmtEur(inv.total)}</span>
                <a
                  href={getPdfUrl(inv.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-night-400 hover:text-loona-300 hover:bg-night-800 transition-loona"
                  title="PDF herunterladen"
                >
                  <FileDown size={16} />
                </a>
                <button
                  onClick={() => handleDelete(inv.id, inv.invoice_number)}
                  className="p-2 rounded-lg text-night-400 hover:text-red-400 hover:bg-night-800 transition-loona"
                  title="Rechnung löschen"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { X, Download, RefreshCw, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import { api } from '../api'
import type { Client, PlanioStats, PlanioImportResult } from '../types'

interface Props {
  client: Client
  onClose: () => void
  onImported: () => void
}

type Step = 'preview' | 'loading-preview' | 'confirm' | 'importing' | 'done' | 'error'

export default function PlanioImport({ client, onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('preview')
  const [stats, setStats] = useState<PlanioStats | null>(null)
  const [importTickets, setImportTickets] = useState(true)
  const [importEntries, setImportEntries] = useState(false)
  const [result, setResult] = useState<PlanioImportResult | null>(null)
  const [error, setError] = useState('')

  async function loadPreview() {
    setStep('loading-preview')
    setError('')
    try {
      const data = await api.getPlanioPreview(client.id)
      if (data.error) {
        setError(data.error)
        setStep('error')
        return
      }
      setStats(data.stats)
      setStep('confirm')
    } catch {
      setError('Verbindung zu Planio fehlgeschlagen.')
      setStep('error')
    }
  }

  async function runImport() {
    if (!importTickets && !importEntries) return
    setStep('importing')
    setError('')
    try {
      const data = await api.planioImport({
        client_id: client.id,
        import_tickets: importTickets,
        import_entries: importEntries,
      })
      if (data.error) {
        setError(data.error)
        setStep('error')
        return
      }
      setResult(data)
      setStep('done')
      onImported()
    } catch {
      setError('Import fehlgeschlagen.')
      setStep('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-night-900 border border-night-700/50 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-night-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: client.color + '33', color: client.color }}>
              <Download size={16} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Planio Import</h3>
              <p className="text-night-400 text-xs">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-night-400 hover:text-white hover:bg-night-800 transition-loona">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* Step: preview start */}
          {step === 'preview' && (
            <>
              <p className="text-night-300 text-sm leading-relaxed">
                Verbindet sich mit <span className="text-white font-mono text-xs break-all">{client.planio_url}</span> und
                prüft, wie viele neue Tickets und Buchungen importiert werden können.
              </p>
              <button
                onClick={loadPreview}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-loona-600 hover:bg-loona-500 text-white rounded-xl text-sm font-medium transition-loona loona-glow-hover"
              >
                <RefreshCw size={15} />
                Verbinden &amp; Vorschau laden
              </button>
            </>
          )}

          {/* Step: loading */}
          {step === 'loading-preview' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader size={28} className="text-loona-400 animate-spin" />
              <p className="text-night-300 text-sm">Verbinde mit Planio…</p>
            </div>
          )}

          {/* Step: confirm */}
          {step === 'confirm' && stats && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-night-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.new_issues}</p>
                  <p className="text-night-400 text-xs mt-1">neue Tickets</p>
                  <p className="text-night-600 text-xs">({stats.total_issues} gesamt)</p>
                </div>
                <div className="bg-night-800 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-white">{stats.new_entries}</p>
                  <p className="text-night-400 text-xs mt-1">neue Buchungen</p>
                  <p className="text-night-600 text-xs">({stats.total_entries} gesamt)</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-night-300 text-xs font-medium uppercase tracking-wide">Was importieren?</p>
                <label className="flex items-center gap-3 p-3 bg-night-800 rounded-xl cursor-pointer hover:bg-night-750 transition-loona">
                  <input
                    type="checkbox"
                    checked={importTickets}
                    onChange={e => setImportTickets(e.target.checked)}
                    className="w-4 h-4 accent-loona-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-white text-sm">Tickets importieren</p>
                    <p className="text-night-400 text-xs">{stats.new_issues} neue Issues aus Planio</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 bg-night-800 rounded-xl cursor-pointer hover:bg-night-750 transition-loona">
                  <input
                    type="checkbox"
                    checked={importEntries}
                    onChange={e => setImportEntries(e.target.checked)}
                    className="w-4 h-4 accent-loona-500 cursor-pointer"
                  />
                  <div>
                    <p className="text-white text-sm">Buchungen importieren</p>
                    <p className="text-night-400 text-xs">{stats.new_entries} neue Zeiteinträge · referenzierte Tickets werden auto-angelegt</p>
                  </div>
                </label>
              </div>

              <button
                onClick={runImport}
                disabled={!importTickets && !importEntries}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-loona-600 hover:bg-loona-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-loona loona-glow-hover"
              >
                <Download size={15} />
                Import starten
              </button>
            </>
          )}

          {/* Step: importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Loader size={28} className="text-loona-400 animate-spin" />
              <p className="text-night-300 text-sm">Importiere Daten…</p>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && result && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <CheckCircle size={40} className="text-emerald-400" />
              <div>
                <p className="text-white font-semibold">Import abgeschlossen</p>
                <p className="text-night-300 text-sm mt-1">
                  {result.tickets_imported} Ticket{result.tickets_imported !== 1 ? 's' : ''} und{' '}
                  {result.entries_imported} Buchung{result.entries_imported !== 1 ? 'en' : ''} importiert.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-night-800 hover:bg-night-700 text-white rounded-xl text-sm font-medium transition-loona"
              >
                Schließen
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-2 text-center">
              <AlertCircle size={40} className="text-red-400" />
              <div>
                <p className="text-white font-semibold">Fehler</p>
                <p className="text-night-300 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => setStep('preview')}
                className="px-6 py-2.5 bg-night-800 hover:bg-night-700 text-white rounded-xl text-sm font-medium transition-loona"
              >
                Erneut versuchen
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

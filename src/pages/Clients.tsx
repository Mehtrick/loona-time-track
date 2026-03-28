import { useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, X, Check, Link, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { api } from '../api'
import type { Client } from '../types'
import PlanioImport from './PlanioImport'

const PRESET_COLORS = [
  '#6b1ae6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
]

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])

  // Planio config state (per-client inline editor)
  const [planioEditId, setPlanioEditId] = useState<number | null>(null)
  const [planioUrl, setPlanioUrl] = useState('')
  const [planioKey, setPlanioKey] = useState('')
  const [planioSaving, setPlanioSaving] = useState(false)

  // Import modal
  const [importClient, setImportClient] = useState<Client | null>(null)

  function load() {
    api.getClients().then(setClients)
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setName('')
    setColor(PRESET_COLORS[0])
    setEditId(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (editId) {
      await api.updateClient(editId, { name: name.trim(), color })
    } else {
      await api.createClient({ name: name.trim(), color })
    }
    resetForm()
    load()
  }

  function startEdit(client: Client) {
    setEditId(client.id)
    setName(client.name)
    setColor(client.color)
    setShowForm(true)
  }

  async function handleDelete(id: number) {
    if (!confirm('Kunden und alle zugehörigen Tickets und Buchungen löschen?')) return
    await api.deleteClient(id)
    load()
  }

  function openPlanioConfig(client: Client) {
    setPlanioEditId(client.id)
    setPlanioUrl(client.planio_url || '')
    setPlanioKey(client.planio_api_key || '')
  }

  async function savePlanioConfig(clientId: number) {
    setPlanioSaving(true)
    await api.updateClientPlanio(clientId, { planio_url: planioUrl.trim(), planio_api_key: planioKey.trim() })
    setPlanioSaving(false)
    setPlanioEditId(null)
    load()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Kunden</h2>
          <p className="text-night-300 mt-1">Verwalte deine Kunden</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-luna-600 hover:bg-luna-500 text-white rounded-xl text-sm font-medium transition-luna luna-glow-hover"
          >
            <Plus size={16} />
            Neuer Kunde
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {editId ? 'Kunde bearbeiten' : 'Neuer Kunde'}
          </h3>
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Kundenname..."
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Farbe</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-lg transition-luna ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-night-900' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2.5 bg-luna-600 hover:bg-luna-500 text-white rounded-xl text-sm font-medium transition-luna"
            >
              <Check size={16} />
              {editId ? 'Speichern' : 'Anlegen'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-2 px-4 py-2.5 bg-night-800 hover:bg-night-700 text-night-300 rounded-xl text-sm font-medium transition-luna"
            >
              <X size={16} />
              Abbrechen
            </button>
          </div>
        </form>
      )}

      {/* Client List */}
      {clients.length === 0 && !showForm ? (
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-12 text-center">
          <Users size={48} className="mx-auto text-night-600 mb-4" />
          <p className="text-night-400 mb-4">Noch keine Kunden angelegt</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-luna-600 hover:bg-luna-500 text-white rounded-xl text-sm font-medium transition-luna"
          >
            Ersten Kunden anlegen
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map(client => (
            <div key={client.id} className="bg-night-900 rounded-xl border border-night-700/50 overflow-hidden">
              {/* Client row */}
              <div className="px-6 py-4 flex items-center justify-between group hover:bg-night-850 transition-luna">
                <div className="flex items-center gap-4">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: client.color }} />
                  <span className="text-white font-medium">{client.name}</span>
                  {client.planio_url && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-night-700 text-night-300 font-mono">
                      Planio
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-luna">
                  {client.planio_url && (
                    <button
                      onClick={() => setImportClient(client)}
                      title="Planio importieren"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-night-400 hover:text-emerald-300 hover:bg-night-800 transition-luna text-xs"
                    >
                      <Download size={13} />
                      Importieren
                    </button>
                  )}
                  <button
                    onClick={() =>
                      planioEditId === client.id ? setPlanioEditId(null) : openPlanioConfig(client)
                    }
                    title="Planio konfigurieren"
                    className={`p-2 rounded-lg transition-luna ${
                      planioEditId === client.id
                        ? 'text-luna-400 bg-night-800'
                        : 'text-night-400 hover:text-luna-300 hover:bg-night-800'
                    }`}
                  >
                    {planioEditId === client.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button
                    onClick={() => startEdit(client)}
                    className="p-2 rounded-lg text-night-400 hover:text-white hover:bg-night-800 transition-luna"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    className="p-2 rounded-lg text-night-400 hover:text-red-400 hover:bg-night-800 transition-luna"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Integrations panel */}
              {planioEditId === client.id && (
                <div className="border-t border-night-700/50">
                  {/* Section header */}
                  <div className="px-6 py-3 bg-night-800/30 border-b border-night-700/30">
                    <p className="text-xs font-semibold text-night-400 uppercase tracking-widest">Integrationen</p>
                  </div>

                  {/* Planio */}
                  <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-night-700 flex items-center justify-center flex-shrink-0">
                      <Link size={12} className="text-luna-400" />
                    </div>
                    <span className="text-sm font-semibold text-white">Planio</span>
                    {client.planio_url && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">Verbunden</span>
                    )}
                  </div>
                  <p className="text-night-400 text-xs leading-relaxed">
                    Hinterlege die URL deiner Planio-Instanz und deinen persönlichen API-Zugriffsschlüssel,
                    um Tickets und Buchungen zu importieren.
                  </p>
                  <div className="bg-night-700/40 border border-night-600/30 rounded-lg px-4 py-3 text-xs text-night-300 leading-relaxed">
                    <span className="text-night-200 font-medium">API-Key finden:</span>{' '}
                    Klicke oben rechts auf dein Nutzerprofil →{' '}
                    <span className="text-white">Mein Konto</span> →
                    auf der rechten Seite findest du den Abschnitt{' '}
                    <span className="text-white">API-Zugriffsschlüssel</span>.
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-night-300 mb-1.5">
                        Planio URL
                      </label>
                      <input
                        type="url"
                        value={planioUrl}
                        onChange={e => setPlanioUrl(e.target.value)}
                        placeholder="https://deinname.planio.com"
                        className="w-full bg-night-700 border border-night-600/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-night-300 mb-1.5">
                        API-Key
                      </label>
                      <input
                        type="password"
                        value={planioKey}
                        onChange={e => setPlanioKey(e.target.value)}
                        placeholder="••••••••••••••••••••••••••••••••••••••••"
                        className="w-full bg-night-700 border border-night-600/50 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => savePlanioConfig(client.id)}
                      disabled={planioSaving}
                      className="flex items-center gap-2 px-4 py-2 bg-luna-600 hover:bg-luna-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-luna"
                    >
                      <Check size={14} />
                      {planioSaving ? 'Speichern…' : 'Speichern'}
                    </button>
                    <button
                      onClick={() => setPlanioEditId(null)}
                      className="flex items-center gap-2 px-4 py-2 bg-night-700 hover:bg-night-600 text-night-300 rounded-lg text-sm font-medium transition-luna"
                    >
                      <X size={14} />
                      Abbrechen
                    </button>
                  </div>
                  </div>{/* end Planio section */}
                </div>{/* end Integrations panel */}
              )}
            </div>
          ))}
        </div>
      )}

      {/* Planio Import Modal */}
      {importClient && (
        <PlanioImport
          client={importClient}
          onClose={() => setImportClient(null)}
          onImported={() => { setImportClient(null); load() }}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Users, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { api } from '../api'
import type { Client } from '../types'

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

      {/* Form */}
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
            <div
              key={client.id}
              className="bg-night-900 rounded-xl border border-night-700/50 px-6 py-4 flex items-center justify-between group hover:border-night-600 transition-luna"
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: client.color }}
                />
                <span className="text-white font-medium">{client.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-luna">
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
          ))}
        </div>
      )}
    </div>
  )
}

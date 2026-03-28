import { useEffect, useState } from 'react'
import { Tag, Plus, Pencil, Trash2, X, Check, Archive } from 'lucide-react'
import { api } from '../api'
import type { Client, Ticket } from '../types'

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [filterClient, setFilterClient] = useState<number | ''>('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const [clientId, setClientId] = useState<number | ''>('')
  const [reference, setReference] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  function load() {
    api.getTickets({
      client_id: filterClient || undefined,
      active: showInactive ? undefined : 1,
    }).then(setTickets)
    api.getClients().then(setClients)
  }

  useEffect(() => { load() }, [filterClient, showInactive])

  function resetForm() {
    setClientId('')
    setReference('')
    setName('')
    setDescription('')
    setEditId(null)
    setShowForm(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !reference.trim() || !name.trim()) return

    if (editId) {
      await api.updateTicket(editId, {
        client_id: Number(clientId),
        reference: reference.trim(),
        name: name.trim(),
        description: description.trim(),
        active: 1,
      })
    } else {
      await api.createTicket({
        client_id: Number(clientId),
        reference: reference.trim(),
        name: name.trim(),
        description: description.trim(),
      })
    }
    resetForm()
    load()
  }

  function startEdit(ticket: Ticket) {
    setEditId(ticket.id)
    setClientId(ticket.client_id)
    setReference(ticket.reference)
    setName(ticket.name)
    setDescription(ticket.description)
    setShowForm(true)
  }

  async function toggleActive(ticket: Ticket) {
    await api.updateTicket(ticket.id, { ...ticket, active: ticket.active ? 0 : 1 })
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm('Ticket und alle zugehörigen Buchungen löschen?')) return
    await api.deleteTicket(id)
    load()
  }

  // Group tickets by client
  const grouped = tickets.reduce<Record<string, Ticket[]>>((acc, t) => {
    const key = t.client_name
    if (!acc[key]) acc[key] = []
    acc[key].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Tickets</h2>
          <p className="text-night-300 mt-1">Ticketkatalog verwalten</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-luna-600 hover:bg-luna-500 text-white rounded-xl text-sm font-medium transition-luna luna-glow-hover"
          >
            <Plus size={16} />
            Neues Ticket
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">
            {editId ? 'Ticket bearbeiten' : 'Neues Ticket'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-night-200 mb-2">Kunde</label>
              <select
                value={clientId}
                onChange={e => setClientId(Number(e.target.value))}
                className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna"
                required
              >
                <option value="">Kunde auswählen...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-night-200 mb-2">Referenz</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="z.B. PROJ-001"
                className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ticket-Bezeichnung..."
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Beschreibung (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Beschreibung..."
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-luna-500 focus:ring-1 focus:ring-luna-500 transition-luna resize-none"
            />
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value ? Number(e.target.value) : '')}
          className="bg-night-800 border border-night-600/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-luna-500"
        >
          <option value="">Alle Kunden</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowInactive(!showInactive)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-luna border ${
            showInactive
              ? 'border-luna-500 bg-luna-600/20 text-luna-200'
              : 'border-night-600/50 bg-night-800 text-night-400 hover:text-white'
          }`}
        >
          <Archive size={14} />
          {showInactive ? 'Inaktive anzeigen' : 'Nur aktive'}
        </button>
      </div>

      {/* Ticket List grouped by client */}
      {Object.keys(grouped).length === 0 ? (
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-12 text-center">
          <Tag size={48} className="mx-auto text-night-600 mb-4" />
          <p className="text-night-400 mb-4">Noch keine Tickets angelegt</p>
          {clients.length === 0 ? (
            <p className="text-night-500 text-sm">Lege zuerst einen Kunden an</p>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2.5 bg-luna-600 hover:bg-luna-500 text-white rounded-xl text-sm font-medium transition-luna"
            >
              Erstes Ticket anlegen
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([clientName, clientTickets]) => (
            <div key={clientName}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: clientTickets[0]?.client_color }}
                />
                <h3 className="text-sm font-semibold text-night-300 uppercase tracking-wider">
                  {clientName}
                </h3>
                <span className="text-xs text-night-500">({clientTickets.length})</span>
              </div>
              <div className="grid gap-2">
                {clientTickets.map(ticket => (
                  <div
                    key={ticket.id}
                    className={`bg-night-900 rounded-xl border px-5 py-3.5 flex items-center justify-between group transition-luna ${
                      ticket.active
                        ? 'border-night-700/50 hover:border-night-600'
                        : 'border-night-800/50 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="px-2.5 py-0.5 bg-night-800 rounded-md text-xs font-mono text-luna-200 font-medium">
                        {ticket.reference}
                      </span>
                      <div>
                        <span className="text-white text-sm font-medium">{ticket.name}</span>
                        {ticket.description && (
                          <p className="text-night-400 text-xs mt-0.5">{ticket.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-luna">
                      <button
                        onClick={() => toggleActive(ticket)}
                        className={`p-2 rounded-lg transition-luna ${
                          ticket.active
                            ? 'text-night-400 hover:text-amber-400 hover:bg-night-800'
                            : 'text-night-400 hover:text-emerald-400 hover:bg-night-800'
                        }`}
                        title={ticket.active ? 'Deaktivieren' : 'Aktivieren'}
                      >
                        <Archive size={14} />
                      </button>
                      <button
                        onClick={() => startEdit(ticket)}
                        className="p-2 rounded-lg text-night-400 hover:text-white hover:bg-night-800 transition-luna"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(ticket.id)}
                        className="p-2 rounded-lg text-night-400 hover:text-red-400 hover:bg-night-800 transition-luna"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

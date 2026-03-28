import { useEffect, useState, useRef } from 'react'
import { Clock, Check, Plus } from 'lucide-react'
import { api } from '../api'
import type { Client, Ticket } from '../types'

export default function TimeEntry() {
  const [clients, setClients] = useState<Client[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])

  const [selectedClient, setSelectedClient] = useState<number | ''>('')
  const [ticketText, setTicketText] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [date, setDate] = useState(today())
  const [hours, setHours] = useState('')
  const [description, setDescription] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getClients().then(setClients)
    api.getTickets({ active: 1 }).then(setTickets)
  }, [])

  // Filter tickets for the selected client matching the typed text
  const filteredTickets = selectedClient
    ? tickets
        .filter(t => t.client_id === Number(selectedClient))
        .filter(t =>
          !ticketText ||
          t.reference.toLowerCase().includes(ticketText.toLowerCase()) ||
          t.name.toLowerCase().includes(ticketText.toLowerCase())
        )
    : []

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClient || !date || !hours) return

    setSaving(true)
    await api.createEntry({
      client_id: Number(selectedClient),
      ticket_text: ticketText.trim() || undefined,
      date,
      hours: parseFloat(hours),
      description,
    })

    // Reload tickets in case a new one was auto-created
    api.getTickets({ active: 1 }).then(setTickets)

    setSaved(true)
    setHours('')
    setDescription('')
    setTicketText('')
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  function selectTicket(ticket: Ticket) {
    setTicketText(ticket.reference)
    setShowSuggestions(false)
  }

  const quickHours = [0.5, 1, 2, 4, 6, 8]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Stunden erfassen</h2>
        <p className="text-night-300 mt-1">Neue Buchung anlegen</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-night-900 rounded-2xl border border-night-700/50 p-6 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Datum</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
              required
            />
          </div>

          {/* Client selection */}
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Kunde *</label>
            {clients.length === 0 ? (
              <p className="text-night-400 text-sm">
                Noch keine Kunden angelegt.{' '}
                <a href="/kunden" className="text-loona-300 hover:underline">Kunden verwalten</a>
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {clients.map(client => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setSelectedClient(selectedClient === client.id ? '' : client.id)
                      setTicketText('')
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-loona border ${
                      selectedClient === client.id
                        ? 'border-loona-500 bg-loona-600/20 text-white'
                        : 'border-night-600/50 bg-night-800 text-night-300 hover:text-white hover:bg-night-700'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: client.color }}
                    />
                    <span className="truncate">{client.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Ticket autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-night-200 mb-2">
              Ticket <span className="text-night-500 font-normal">(optional - wird automatisch angelegt)</span>
            </label>
            {!selectedClient ? (
              <p className="text-night-500 text-sm">Bitte wähle zuerst einen Kunden</p>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="text"
                  value={ticketText}
                  onChange={e => {
                    setTicketText(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Ticket-Referenz eingeben oder auswählen..."
                  className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
                  autoComplete="off"
                />
                {showSuggestions && filteredTickets.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-10 left-0 right-0 mt-1 bg-night-800 border border-night-600/50 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                  >
                    {filteredTickets.map(ticket => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => selectTicket(ticket)}
                        className="w-full text-left px-4 py-2.5 hover:bg-night-700 transition-loona flex items-center gap-3 first:rounded-t-xl last:rounded-b-xl"
                      >
                        <span className="px-2 py-0.5 bg-night-900 rounded text-xs font-mono text-loona-200">
                          {ticket.reference}
                        </span>
                        <span className="text-sm text-night-200 truncate">{ticket.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                {ticketText && filteredTickets.length === 0 && showSuggestions && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-night-800 border border-night-600/50 rounded-xl shadow-xl px-4 py-3">
                    <p className="text-sm text-night-300">
                      <Plus size={12} className="inline mr-1" />
                      <span className="text-loona-300">"{ticketText}"</span> wird beim Speichern als neues Ticket angelegt
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hours */}
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Stunden *</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {quickHours.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(String(h))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-loona border ${
                    hours === String(h)
                      ? 'border-loona-500 bg-loona-600/20 text-loona-200'
                      : 'border-night-600/50 bg-night-800 text-night-400 hover:text-white'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="Stunden eingeben..."
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-night-200 mb-2">Beschreibung</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Was hast du gemacht?"
              className="w-full bg-night-800 border border-night-600/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-loona-500 focus:ring-1 focus:ring-loona-500 transition-loona resize-none"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!selectedClient || !hours || saving}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium text-white transition-loona ${
            saved
              ? 'bg-emerald-600'
              : 'bg-loona-600 hover:bg-loona-500 loona-glow-hover disabled:opacity-40 disabled:cursor-not-allowed'
          }`}
        >
          {saved ? (
            <>
              <Check size={18} />
              Gespeichert!
            </>
          ) : (
            <>
              <Plus size={18} />
              Buchung speichern
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function today() {
  return new Date().toISOString().split('T')[0]
}

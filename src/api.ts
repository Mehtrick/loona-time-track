// In Electron mode, the Express server runs on a dynamic port passed via ?port=XXXXX
// In web dev mode, Vite proxies /api to localhost:3001
function getBaseUrl(): string {
  const params = new URLSearchParams(window.location.search)
  const port = params.get('port')
  if (port) {
    return `http://127.0.0.1:${port}/api`
  }
  return '/api'
}

const BASE = getBaseUrl()

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  return res.json()
}

export const api = {
  // Clients
  getClients: () => request<any[]>('/clients'),
  createClient: (data: { name: string; color: string }) =>
    request<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number, data: { name: string; color: string }) =>
    request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number) =>
    request<any>(`/clients/${id}`, { method: 'DELETE' }),

  // Tickets
  getTickets: (params?: { client_id?: number; active?: number }) => {
    const query = new URLSearchParams()
    if (params?.client_id) query.set('client_id', String(params.client_id))
    if (params?.active !== undefined) query.set('active', String(params.active))
    return request<any[]>(`/tickets?${query}`)
  },
  createTicket: (data: { client_id: number; reference: string; name: string; description?: string }) =>
    request<any>('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  updateTicket: (id: number, data: any) =>
    request<any>(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTicket: (id: number) =>
    request<any>(`/tickets/${id}`, { method: 'DELETE' }),

  // Time Entries
  getEntries: (params?: { client_id?: number; ticket_id?: number; show_billed?: boolean; from?: string; to?: string }) => {
    const query = new URLSearchParams()
    if (params?.client_id) query.set('client_id', String(params.client_id))
    if (params?.ticket_id) query.set('ticket_id', String(params.ticket_id))
    if (params?.show_billed) query.set('show_billed', '1')
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    return request<any[]>(`/entries?${query}`)
  },
  getSummary: () => request<any[]>('/entries/summary'),
  createEntry: (data: { client_id: number; ticket_text?: string; date: string; hours: number; description?: string }) =>
    request<any>('/entries', { method: 'POST', body: JSON.stringify(data) }),
  updateEntry: (id: number, data: any) =>
    request<any>(`/entries/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteEntry: (id: number) =>
    request<any>(`/entries/${id}`, { method: 'DELETE' }),
}

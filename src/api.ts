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

export function getPdfUrl(invoiceId: number): string {
  return `${BASE}/invoices/${invoiceId}/pdf`
}

export function getDownloadAllUrl(): string {
  return `${BASE}/invoices/download-all`
}

export const api = {
  // Clients
  getClients: () => request<any[]>('/clients'),
  createClient: (data: any) =>
    request<any>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (id: number, data: any) =>
    request<any>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: number) =>
    request<any>(`/clients/${id}`, { method: 'DELETE' }),

  updateClientPlanio: (id: number, data: { planio_url: string; planio_api_key: string }) =>
    request<any>(`/clients/${id}/planio`, { method: 'PUT', body: JSON.stringify(data) }),

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

  // Settings
  getSettings: () => request<any>('/settings'),
  updateSettings: (data: any) =>
    request<any>('/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Invoices
  getInvoices: () => request<any[]>('/invoices'),
  getInvoice: (id: number) => request<any>(`/invoices/${id}`),
  getNextInvoiceNumber: () => request<{ next: string }>('/invoices/next-number'),
  createInvoice: (data: any) =>
    request<any>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  deleteInvoice: (id: number) =>
    request<any>(`/invoices/${id}`, { method: 'DELETE' }),

  // Planio
  getPlanioPreview: (clientId: number) =>
    request<any>(`/planio/preview?client_id=${clientId}`),
  planioImport: (data: { client_id: number; import_tickets: boolean; import_entries: boolean }) =>
    request<any>('/planio/import', { method: 'POST', body: JSON.stringify(data) }),

  // Export / Import
  getExportUrl: () => `${BASE}/export`,
  importData: (data: { data: any; conflicts?: Record<string, 'overwrite' | 'skip'>; import_settings?: boolean }) =>
    fetch(`${BASE}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Status & Verschlüsselung
  getStatus: () => request<{ locked: boolean; encrypted: boolean; firstLaunch: boolean }>('/status'),
  unlock: (password: string) =>
    fetch(`${BASE}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    }),
  setEncryptionPassword: (password: string) =>
    request<{ ok: boolean }>('/encryption', { method: 'POST', body: JSON.stringify({ password }) }),
  removeEncryption: () =>
    request<{ ok: boolean }>('/encryption', { method: 'DELETE' }),
}

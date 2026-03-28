export interface Client {
  id: number
  name: string
  color: string
  planio_url?: string
  planio_api_key?: string
  created_at: string
}

export interface PlanioStats {
  total_issues: number
  new_issues: number
  total_entries: number
  new_entries: number
}

export interface PlanioImportResult {
  ok: boolean
  tickets_imported: number
  entries_imported: number
}

export interface Ticket {
  id: number
  client_id: number
  reference: string
  name: string
  description: string
  active: number
  client_name: string
  client_color: string
  created_at: string
}

export interface TimeEntry {
  id: number
  client_id: number
  ticket_id: number | null
  date: string
  hours: number
  description: string
  billed: string
  ticket_reference: string
  ticket_name: string
  client_name: string
  client_color: string
  client_id: number
  created_at: string
}

export interface ClientSummary {
  client_id: number
  client_name: string
  client_color: string
  total_hours: number
  entry_count: number
}

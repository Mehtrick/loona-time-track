import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Current schema version - increment when adding a new migration
export const CURRENT_VERSION = 2;

// Migrations: each function transforms data from version N-1 to N.
// Index 0 = migration to version 1, index 1 = migration to version 2, etc.
export const migrations = [
  // v0 -> v1: Initial schema (baseline for pre-versioned data)
  (data) => {
    data.clients = data.clients || [];
    data.tickets = data.tickets || [];
    data.entries = data.entries || [];
    data.nextId = data.nextId || { clients: 1, tickets: 1, entries: 1 };
    return data;
  },

  // v1 -> v2: Entries get direct client_id (previously derived from ticket only)
  (data) => {
    for (const entry of data.entries) {
      if (!entry.client_id && entry.ticket_id) {
        const ticket = data.tickets.find(t => t.id === entry.ticket_id);
        if (ticket) {
          entry.client_id = ticket.client_id;
        }
      }
      // Ensure ticket_id field exists (may be null)
      if (entry.ticket_id === undefined) {
        entry.ticket_id = null;
      }
    }
    return data;
  },
];

export function migrateData(data) {
  const fromVersion = data.version || 0;

  if (fromVersion >= CURRENT_VERSION) {
    return { data, migrated: false };
  }

  for (let v = fromVersion; v < CURRENT_VERSION; v++) {
    data = migrations[v](data);
  }

  data.version = CURRENT_VERSION;
  return { data, migrated: true };
}

export function createApp(dataFilePath) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  function emptyData() {
    return {
      version: CURRENT_VERSION,
      clients: [],
      tickets: [],
      entries: [],
      nextId: { clients: 1, tickets: 1, entries: 1 },
    };
  }

  function loadData() {
    if (!existsSync(dataFilePath)) {
      return emptyData();
    }
    const raw = JSON.parse(readFileSync(dataFilePath, 'utf-8'));
    const { data, migrated } = migrateData(raw);
    if (migrated) {
      writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
    }
    return data;
  }

  function saveData(data) {
    data.version = CURRENT_VERSION;
    writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  function now() {
    return new Date().toISOString();
  }

  // === CLIENTS ===
  app.get('/api/clients', (req, res) => {
    const data = loadData();
    res.json(data.clients.sort((a, b) => a.name.localeCompare(b.name)));
  });

  app.post('/api/clients', (req, res) => {
    const data = loadData();
    const client = {
      id: data.nextId.clients++,
      name: req.body.name,
      color: req.body.color || '#6b1ae6',
      created_at: now(),
    };
    data.clients.push(client);
    saveData(data);
    res.json(client);
  });

  app.put('/api/clients/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    const client = data.clients.find(c => c.id === id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    client.name = req.body.name ?? client.name;
    client.color = req.body.color ?? client.color;
    saveData(data);
    res.json(client);
  });

  app.delete('/api/clients/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    data.clients = data.clients.filter(c => c.id !== id);
    data.tickets = data.tickets.filter(t => t.client_id !== id);
    data.entries = data.entries.filter(e => e.client_id !== id);
    saveData(data);
    res.json({ ok: true });
  });

  app.put('/api/clients/:id/planio', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    const client = data.clients.find(c => c.id === id);
    if (!client) return res.status(404).json({ error: 'Not found' });
    client.planio_url = req.body.planio_url ?? client.planio_url ?? '';
    client.planio_api_key = req.body.planio_api_key ?? client.planio_api_key ?? '';
    saveData(data);
    res.json(client);
  });

  // === TICKETS ===
  app.get('/api/tickets', (req, res) => {
    const data = loadData();
    let tickets = data.tickets.map(t => {
      const client = data.clients.find(c => c.id === t.client_id);
      return { ...t, client_name: client?.name || '', client_color: client?.color || '#666' };
    });
    if (req.query.client_id) tickets = tickets.filter(t => t.client_id === Number(req.query.client_id));
    if (req.query.active !== undefined) tickets = tickets.filter(t => t.active === Number(req.query.active));
    tickets.sort((a, b) => a.client_name.localeCompare(b.client_name) || a.reference.localeCompare(b.reference));
    res.json(tickets);
  });

  app.post('/api/tickets', (req, res) => {
    const data = loadData();
    const ticket = {
      id: data.nextId.tickets++,
      client_id: req.body.client_id,
      reference: req.body.reference,
      name: req.body.name,
      description: req.body.description || '',
      active: 1,
      created_at: now(),
    };
    data.tickets.push(ticket);
    saveData(data);
    const client = data.clients.find(c => c.id === ticket.client_id);
    res.json({ ...ticket, client_name: client?.name || '', client_color: client?.color || '#666' });
  });

  app.put('/api/tickets/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    const ticket = data.tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'Not found' });
    ticket.client_id = req.body.client_id ?? ticket.client_id;
    ticket.reference = req.body.reference ?? ticket.reference;
    ticket.name = req.body.name ?? ticket.name;
    ticket.description = req.body.description ?? ticket.description;
    ticket.active = req.body.active ?? ticket.active;
    saveData(data);
    const client = data.clients.find(c => c.id === ticket.client_id);
    res.json({ ...ticket, client_name: client?.name || '', client_color: client?.color || '#666' });
  });

  app.delete('/api/tickets/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    data.tickets = data.tickets.filter(t => t.id !== id);
    data.entries = data.entries.filter(e => e.ticket_id !== id);
    saveData(data);
    res.json({ ok: true });
  });

  // === TIME ENTRIES ===

  function resolveClientId(e, data) {
    if (e.client_id) return e.client_id;
    if (e.ticket_id) {
      const ticket = data.tickets.find(t => t.id === e.ticket_id);
      if (ticket) return ticket.client_id;
    }
    return null;
  }

  function enrichEntry(e, data) {
    const clientId = resolveClientId(e, data);
    const ticket = e.ticket_id ? data.tickets.find(t => t.id === e.ticket_id) : null;
    const client = clientId ? data.clients.find(c => c.id === clientId) : null;
    return {
      ...e,
      client_id: clientId,
      ticket_reference: ticket?.reference || '',
      ticket_name: ticket?.name || '',
      client_name: client?.name || '',
      client_color: client?.color || '#666',
    };
  }

  app.get('/api/entries', (req, res) => {
    const data = loadData();
    let entries = data.entries.map(e => enrichEntry(e, data));

    if (req.query.show_billed !== '1') {
      entries = entries.filter(e => !e.billed);
    }
    if (req.query.client_id) entries = entries.filter(e => e.client_id === Number(req.query.client_id));
    if (req.query.ticket_id) entries = entries.filter(e => e.ticket_id === Number(req.query.ticket_id));
    if (req.query.from) entries = entries.filter(e => e.date >= req.query.from);
    if (req.query.to) entries = entries.filter(e => e.date <= req.query.to);

    entries.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
    res.json(entries);
  });

  app.get('/api/entries/summary', (req, res) => {
    const data = loadData();
    const summaryMap = {};
    for (const client of data.clients) {
      summaryMap[client.id] = {
        client_id: client.id,
        client_name: client.name,
        client_color: client.color,
        total_hours: 0,
        entry_count: 0,
      };
    }
    for (const entry of data.entries) {
      if (entry.billed) continue;
      const clientId = resolveClientId(entry, data);
      const s = clientId ? summaryMap[clientId] : null;
      if (s) {
        s.total_hours += entry.hours;
        s.entry_count++;
      }
    }
    const summary = Object.values(summaryMap).sort((a, b) => b.total_hours - a.total_hours);
    res.json(summary);
  });

  app.post('/api/entries', (req, res) => {
    const data = loadData();
    const { client_id, date, hours, description, ticket_text } = req.body;

    let ticket_id = null;
    if (ticket_text && ticket_text.trim()) {
      const text = ticket_text.trim();
      let ticket = data.tickets.find(t =>
        t.client_id === client_id &&
        (t.reference.toLowerCase() === text.toLowerCase() || t.name.toLowerCase() === text.toLowerCase())
      );
      if (!ticket) {
        ticket = {
          id: data.nextId.tickets++,
          client_id,
          reference: text,
          name: text,
          description: '',
          active: 1,
          created_at: now(),
        };
        data.tickets.push(ticket);
      }
      ticket_id = ticket.id;
    }

    const entry = {
      id: data.nextId.entries++,
      client_id,
      ticket_id,
      date,
      hours,
      description: description || '',
      billed: '',
      created_at: now(),
    };
    data.entries.push(entry);
    saveData(data);
    res.json(enrichEntry(entry, data));
  });

  app.put('/api/entries/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    const entry = data.entries.find(e => e.id === id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    entry.client_id = req.body.client_id ?? entry.client_id;
    entry.ticket_id = req.body.ticket_id ?? entry.ticket_id;
    entry.date = req.body.date ?? entry.date;
    entry.hours = req.body.hours ?? entry.hours;
    entry.description = req.body.description ?? entry.description;
    entry.billed = req.body.billed ?? entry.billed;
    saveData(data);
    res.json(enrichEntry(entry, data));
  });

  app.delete('/api/entries/:id', (req, res) => {
    const data = loadData();
    data.entries = data.entries.filter(e => e.id !== Number(req.params.id));
    saveData(data);
    res.json({ ok: true });
  });

  // === PLANIO INTEGRATION ===

  async function planioFetchAll(baseUrl, apiKey, resource, extraParams = '') {
    const items = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const url = `${baseUrl.replace(/\/$/, '')}/${resource}.json?limit=${limit}&offset=${offset}${extraParams}`;
      const res = await fetch(url, { headers: { 'X-Redmine-API-Key': apiKey } });
      if (!res.ok) throw new Error(`Planio API ${res.status}: ${res.statusText}`);
      const json = await res.json();
      const records = json[resource];
      if (!records || records.length === 0) break;
      items.push(...records);
      if (items.length >= (json.total_count ?? items.length)) break;
      offset += limit;
    }
    return items;
  }

  async function planioGetCurrentUserId(baseUrl, apiKey) {
    const url = `${baseUrl.replace(/\/$/, '')}/my/account.json`;
    const res = await fetch(url, { headers: { 'X-Redmine-API-Key': apiKey } });
    if (!res.ok) throw new Error(`Planio API ${res.status}: ${res.statusText}`);
    const json = await res.json();
    return json.user?.id ?? null;
  }

  // Maps a Planio time entry to Luna entry fields.
  // If comments contain "Abgerechnet" → billed field; otherwise → description field.
  function mapEntryFields(te) {
    const comment = te.comments || '';
    const isAbgerechnet = /abgerechnet/i.test(comment);
    return {
      description: isAbgerechnet ? (te.activity?.name || '') : (comment || te.activity?.name || ''),
      billed: isAbgerechnet ? comment : '',
    };
  }

  // GET /api/planio/preview?client_id=X
  app.get('/api/planio/preview', async (req, res) => {
    const data = loadData();
    const clientId = Number(req.query.client_id);
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.planio_url || !client.planio_api_key) {
      return res.status(400).json({ error: 'Planio nicht konfiguriert' });
    }

    try {
      // Fetch current user so we only count their own time entries
      const userId = await planioGetCurrentUserId(client.planio_url, client.planio_api_key);
      const userParam = userId ? `&user_id=${userId}` : '';

      const [issues, timeEntries] = await Promise.all([
        planioFetchAll(client.planio_url, client.planio_api_key, 'issues', '&status_id=*'),
        planioFetchAll(client.planio_url, client.planio_api_key, 'time_entries', userParam),
      ]);

      const existingTicketIds = new Set(
        data.tickets.filter(t => t.planio_id).map(t => t.planio_id)
      );
      const existingEntryIds = new Set(
        data.entries.filter(e => e.planio_id).map(e => e.planio_id)
      );

      res.json({
        stats: {
          total_issues: issues.length,
          new_issues: issues.filter(i => !existingTicketIds.has(i.id)).length,
          total_entries: timeEntries.length,
          new_entries: timeEntries.filter(e => !existingEntryIds.has(e.id)).length,
        },
      });
    } catch (err) {
      res.status(502).json({ error: `Planio nicht erreichbar: ${err.message}` });
    }
  });

  // POST /api/planio/import
  // Body: { client_id, import_tickets: bool, import_entries: bool }
  app.post('/api/planio/import', async (req, res) => {
    const data = loadData();
    const { client_id, import_tickets, import_entries } = req.body;
    const clientId = Number(client_id);
    const client = data.clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    if (!client.planio_url || !client.planio_api_key) {
      return res.status(400).json({ error: 'Planio nicht konfiguriert' });
    }

    try {
      // Fetch current user so we only import their own time entries
      const userId = import_entries
        ? await planioGetCurrentUserId(client.planio_url, client.planio_api_key)
        : null;
      const userParam = userId ? `&user_id=${userId}` : '';

      // Always fetch issues when importing entries (needed to resolve ticket references)
      const fetchIssues = import_tickets || import_entries;
      const [issues, timeEntries] = await Promise.all([
        fetchIssues
          ? planioFetchAll(client.planio_url, client.planio_api_key, 'issues', '&status_id=*')
          : Promise.resolve([]),
        import_entries
          ? planioFetchAll(client.planio_url, client.planio_api_key, 'time_entries', userParam)
          : Promise.resolve([]),
      ]);

      const existingTicketPlanioIds = new Set(
        data.tickets.filter(t => t.planio_id).map(t => t.planio_id)
      );
      const existingEntryPlanioIds = new Set(
        data.entries.filter(e => e.planio_id).map(e => e.planio_id)
      );

      let ticketsImported = 0;
      let entriesImported = 0;

      if (import_tickets) {
        for (const issue of issues) {
          if (existingTicketPlanioIds.has(issue.id)) continue;
          const ticket = {
            id: data.nextId.tickets++,
            client_id: clientId,
            planio_id: issue.id,
            reference: `#${issue.id}`,
            name: issue.subject,
            description: issue.description || '',
            active: issue.status?.is_closed ? 0 : 1,
            created_at: issue.created_on || now(),
          };
          data.tickets.push(ticket);
          existingTicketPlanioIds.add(issue.id);
          ticketsImported++;
        }
      }

      if (import_entries) {
        for (const te of timeEntries) {
          if (existingEntryPlanioIds.has(te.id)) continue;

          // Find or auto-create ticket for this time entry
          let ticketId = null;
          if (te.issue?.id) {
            let ticket = data.tickets.find(
              t => t.planio_id === te.issue.id && t.client_id === clientId
            );
            if (!ticket) {
              const issue = issues.find(i => i.id === te.issue.id);
              ticket = {
                id: data.nextId.tickets++,
                client_id: clientId,
                planio_id: te.issue.id,
                reference: `#${te.issue.id}`,
                name: issue?.subject || `Planio #${te.issue.id}`,
                description: issue?.description || '',
                active: issue?.status?.is_closed ? 0 : 1,
                created_at: issue?.created_on || now(),
              };
              data.tickets.push(ticket);
              existingTicketPlanioIds.add(te.issue.id);
              ticketsImported++;
            }
            ticketId = ticket.id;
          }

          const { description, billed } = mapEntryFields(te);
          const entry = {
            id: data.nextId.entries++,
            client_id: clientId,
            planio_id: te.id,
            ticket_id: ticketId,
            date: te.spent_on,
            hours: te.hours,
            description,
            billed,
            created_at: te.created_on || now(),
          };
          data.entries.push(entry);
          entriesImported++;
        }
      }

      saveData(data);
      res.json({ ok: true, tickets_imported: ticketsImported, entries_imported: entriesImported });
    } catch (err) {
      res.status(502).json({ error: `Planio nicht erreichbar: ${err.message}` });
    }
  });

  return app;
}

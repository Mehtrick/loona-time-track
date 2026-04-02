import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Datei-Header für passwortbasierte Verschlüsselung
const LOONA_ENC_PW_HEADER = 'LOONA_ENC_PW_V1:';
// Scrypt-Parameter: N=16384 entspricht ~100ms auf normaler Hardware
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

/**
 * Leitet einen 32-Byte-AES-Schlüssel aus Passwort + Salt via scrypt ab.
 */
async function deriveKey(password, salt) {
  return scryptAsync(password, salt, 32, SCRYPT_PARAMS);
}

/**
 * Verschlüsselt plaintext mit dem gegebenen Schlüssel (AES-256-GCM).
 * Kodierung: LOONA_ENC_PW_V1:<saltHex>:<ivHex>:<authTagHex>:<ciphertextHex>
 */
function encryptWithKey(plaintext, key, salt) {
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${LOONA_ENC_PW_HEADER}${salt.toString('hex')}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Entschlüsselt einen LOONA_ENC_PW_V1-String mit dem gegebenen Schlüssel.
 * Wirft einen Fehler wenn Schlüssel oder Daten ungültig sind.
 */
function decryptWithKey(raw, key) {
  const rest = raw.slice(LOONA_ENC_PW_HEADER.length);
  // Format: <saltHex>:<ivHex>:<authTagHex>:<ciphertextHex>
  const firstColon = rest.indexOf(':');
  const secondColon = rest.indexOf(':', firstColon + 1);
  const thirdColon = rest.indexOf(':', secondColon + 1);
  const ivHex = rest.slice(firstColon + 1, secondColon);
  const authTagHex = rest.slice(secondColon + 1, thirdColon);
  const ciphertextHex = rest.slice(thirdColon + 1);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

// Current schema version - increment when adding a new migration
export const CURRENT_VERSION = 3;

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
      if (entry.ticket_id === undefined) {
        entry.ticket_id = null;
      }
    }
    return data;
  },

  // v2 -> v3: Add settings, invoices, lastInvoiceNumber; client address fields
  (data) => {
    data.settings = data.settings || {};
    data.invoices = data.invoices || [];
    data.lastInvoiceNumber = data.lastInvoiceNumber || '';
    data.nextId.invoices = data.nextId.invoices || 1;
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

  // Aktueller Entschlüsselungsschlüssel (Buffer wenn entsperrt, null wenn unverschlüsselt oder gesperrt)
  let currentKey = null;
  // Der Salt der beim aktuellen Schlüssel verwendet wurde (muss beim Speichern wiederverwendet werden)
  let currentSalt = null;
  // true wenn die Datei passwortgeschützt ist und noch nicht entsperrt wurde
  let locked = false;

  function isFilePasswordEncrypted() {
    if (!existsSync(dataFilePath)) return false;
    try {
      return readFileSync(dataFilePath, 'utf-8').startsWith(LOONA_ENC_PW_HEADER);
    } catch {
      return false;
    }
  }

  // Sperrzustand beim Start initialisieren
  locked = isFilePasswordEncrypted();

  function emptyData() {
    return {
      version: CURRENT_VERSION,
      settings: {},
      clients: [],
      tickets: [],
      entries: [],
      invoices: [],
      lastInvoiceNumber: '',
      nextId: { clients: 1, tickets: 1, entries: 1, invoices: 1 },
    };
  }

  function serializeData(data) {
    const json = JSON.stringify(data, null, 2);
    if (currentKey) {
      return encryptWithKey(json, currentKey, currentSalt);
    }
    return json;
  }

  function loadData() {
    if (!existsSync(dataFilePath)) return emptyData();
    const raw = readFileSync(dataFilePath, 'utf-8');
    let parsed;
    if (raw.startsWith(LOONA_ENC_PW_HEADER)) {
      parsed = JSON.parse(decryptWithKey(raw, currentKey));
    } else {
      parsed = JSON.parse(raw);
    }
    const { data, migrated } = migrateData(parsed);
    if (migrated) writeFileSync(dataFilePath, serializeData(data), 'utf-8');
    return data;
  }

  function saveData(data) {
    data.version = CURRENT_VERSION;
    writeFileSync(dataFilePath, serializeData(data), 'utf-8');
  }

  function now() {
    return new Date().toISOString();
  }

  // === STATUS & ENTSPERREN (auch im gesperrten Zustand erreichbar) ===

  app.get('/api/status', (req, res) => {
    const encrypted = isFilePasswordEncrypted();
    const firstLaunch = !existsSync(dataFilePath);
    res.json({ locked, encrypted, firstLaunch });
  });

  app.post('/api/unlock', async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Kein Passwort angegeben.' });
    if (!isFilePasswordEncrypted()) {
      locked = false;
      return res.json({ ok: true });
    }
    try {
      const raw = readFileSync(dataFilePath, 'utf-8');
      const rest = raw.slice(LOONA_ENC_PW_HEADER.length);
      const saltHex = rest.slice(0, rest.indexOf(':'));
      const salt = Buffer.from(saltHex, 'hex');
      const key = await deriveKey(password, salt);
      // Entschlüsselung verifizieren – wirft einen Fehler bei falschem Passwort
      JSON.parse(decryptWithKey(raw, key));
      currentKey = key;
      currentSalt = salt;
      locked = false;
      res.json({ ok: true });
    } catch {
      res.status(401).json({ error: 'Falsches Passwort.' });
    }
  });

  // === LOCK-GUARD: nur API-Routen sperren, statische Dateien immer erlauben ===
  app.use('/api', (req, res, next) => {
    if (locked) return res.status(503).json({ error: 'locked' });
    next();
  });

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
      address_line1: req.body.address_line1 || '',
      address_line2: req.body.address_line2 || '',
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
    client.address_line1 = req.body.address_line1 ?? client.address_line1 ?? '';
    client.address_line2 = req.body.address_line2 ?? client.address_line2 ?? '';
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

  // === SETTINGS ===
  app.get('/api/settings', (req, res) => {
    const data = loadData();
    res.json(data.settings || {});
  });

  app.put('/api/settings', (req, res) => {
    const data = loadData();
    data.settings = { ...data.settings, ...req.body };
    saveData(data);
    res.json(data.settings);
  });

  // === INVOICES ===

  function suggestNextInvoiceNumber(lastNumber) {
    const year = new Date().getFullYear().toString();
    const last = lastNumber != null ? String(lastNumber) : '';

    // Format: YYYY-NNNNN (z. B. "2026-00001" → "2026-00002")
    const dashMatch = last && last.match(/^(\d{4})-(\d{5})$/);
    if (dashMatch) {
      const [, lastYear, numStr] = dashMatch;
      if (lastYear === year) {
        return year + '-' + String(parseInt(numStr, 10) + 1).padStart(5, '0');
      }
      // Neues Jahr: Zähler zurücksetzen, 5 Stellen beibehalten
      return year + '-' + '1'.padStart(5, '0');
    }

    // Format: YYYYnnnnnn (z. B. "2026000001" → "2026000002")
    if (last && last.startsWith(year)) {
      const num = parseInt(last.slice(4), 10);
      return year + String(num + 1).padStart(6, '0');
    }

    // Reine Ganzzahl (z. B. "42" → "43")
    if (last && /^\d+$/.test(last)) {
      return String(parseInt(last, 10) + 1);
    }

    return year + '000001';
  }

  app.get('/api/invoices/next-number', (req, res) => {
    const data = loadData();
    res.json({ next: suggestNextInvoiceNumber(data.lastInvoiceNumber) });
  });

  app.get('/api/invoices/download-all', async (req, res) => {
    const data = loadData();
    if (!data.invoices.length) {
      return res.status(404).json({ error: 'Keine Rechnungen vorhanden' });
    }

    let archiver;
    try {
      archiver = (await import('archiver')).default;
    } catch {
      return res.status(500).json({ error: 'ZIP-Bibliothek nicht verfuegbar' });
    }

    const s = data.settings || {};
    const archive = archiver('zip', { zlib: { level: 6 } });

    // Client-Map für O(1)-Nachschlag statt O(n*m)
    const clientMap = new Map(data.clients.map(c => [c.id, c]));

    let zipFehler = null;
    const handleZipError = err => {
      if (zipFehler) return;
      zipFehler = err;
      console.error('ZIP-Fehler:', err);
      try { archive.abort(); } catch { /* ignore */ }
      if (!res.headersSent) return res.status(500).json({ error: 'ZIP-Download fehlgeschlagen' });
      if (!res.destroyed) res.destroy(err);
    };

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="Rechnungen.zip"',
    });

    archive.on('error', handleZipError);
    archive.pipe(res);

    for (const invoice of data.invoices) {
      if (zipFehler || res.destroyed) break;
      const client = clientMap.get(invoice.client_id);
      // Zip-Slip-Schutz: nur alphanumerische Zeichen, Bindestrich und Unterstrich erlaubt
      const safeName = String(invoice.invoice_number).replace(/[^a-zA-Z0-9\-_]/g, '_');
      try {
        const pdf = await buildInvoicePdf(invoice, client, s);
        if (zipFehler || res.destroyed) break;
        archive.append(pdf, { name: `Rechnung_${safeName}.pdf` });
      } catch (err) {
        handleZipError(err);
        break;
      }
    }

    if (zipFehler || res.destroyed) return;
    try {
      await archive.finalize();
    } catch (err) {
      handleZipError(err);
    }
  });

  app.get('/api/invoices', (req, res) => {
    const data = loadData();
    const invoices = data.invoices.map(inv => {
      const client = data.clients.find(c => c.id === inv.client_id);
      return { ...inv, client_name: client?.name || '', client_color: client?.color || '#666' };
    });
    invoices.sort((a, b) => b.date.localeCompare(a.date));
    res.json(invoices);
  });

  app.get('/api/invoices/:id', (req, res) => {
    const data = loadData();
    const invoice = data.invoices.find(i => i.id === Number(req.params.id));
    if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    const client = data.clients.find(c => c.id === invoice.client_id);
    res.json({ ...invoice, client_name: client?.name || '', client_color: client?.color || '#666' });
  });

  app.post('/api/invoices', (req, res) => {
    const data = loadData();
    const { client_id, invoice_number, date, due_date, hourly_rate, entry_ids } = req.body;

    if (!client_id || !invoice_number || !date || !entry_ids?.length) {
      return res.status(400).json({ error: 'Pflichtfelder fehlen' });
    }

    // Check uniqueness of invoice number
    if (data.invoices.some(i => i.invoice_number === invoice_number)) {
      return res.status(409).json({ error: 'Rechnungsnummer existiert bereits' });
    }

    const rate = hourly_rate || data.settings?.hourly_rate || 80;

    // Build line items from entries
    const items = [];
    for (const eid of entry_ids) {
      const entry = data.entries.find(e => e.id === eid);
      if (!entry) continue;
      const ticket = entry.ticket_id ? data.tickets.find(t => t.id === entry.ticket_id) : null;
      const desc = entry.description || ticket?.name || 'Dienstleistung';
      const ticketRef = ticket?.reference ? ` (${ticket.reference})` : '';
      items.push({
        entry_id: eid,
        description: desc + ticketRef,
        hours: entry.hours,
        rate,
        amount: Math.round(entry.hours * rate * 100) / 100,
      });
    }

    const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;

    const invoice = {
      id: data.nextId.invoices++,
      invoice_number,
      client_id,
      date,
      due_date: due_date || '',
      hourly_rate: rate,
      items,
      total,
      created_at: now(),
    };

    data.invoices.push(invoice);
    data.lastInvoiceNumber = invoice_number;

    // Mark entries as billed
    for (const eid of entry_ids) {
      const entry = data.entries.find(e => e.id === eid);
      if (entry) entry.billed = invoice_number;
    }

    saveData(data);
    res.json(invoice);
  });

  app.delete('/api/invoices/:id', (req, res) => {
    const data = loadData();
    const id = Number(req.params.id);
    const invoice = data.invoices.find(i => i.id === id);
    if (!invoice) return res.status(404).json({ error: 'Not found' });

    // Unmark entries
    for (const item of invoice.items) {
      const entry = data.entries.find(e => e.id === item.entry_id);
      if (entry && entry.billed === invoice.invoice_number) {
        entry.billed = '';
      }
    }

    data.invoices = data.invoices.filter(i => i.id !== id);
    saveData(data);
    res.json({ ok: true });
  });

  // Find a system font that supports Unicode/German umlauts
  function findUnicodeFont() {
    const candidates = [
      'C:\\Windows\\Fonts\\calibri.ttf',
      'C:\\Windows\\Fonts\\arial.ttf',
      'C:\\Windows\\Fonts\\segoeui.ttf',
      '/System/Library/Fonts/Supplemental/Arial.ttf',
      '/Library/Fonts/Arial.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    ];
    for (const p of candidates) {
      try { if (existsSync(p)) return p; } catch { /* skip */ }
    }
    return null;
  }

  // PDF generation for invoices
  app.get('/api/invoices/:id/pdf', async (req, res) => {
    const data = loadData();
    const invoice = data.invoices.find(i => i.id === Number(req.params.id));
    if (!invoice) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    const client = data.clients.find(c => c.id === invoice.client_id);
    const s = data.settings || {};
    try {
      const pdf = await buildInvoicePdf(invoice, client, s);
      // Zip-Slip-Schutz: nur sichere Zeichen im Dateinamen
      const safeName = String(invoice.invoice_number).replace(/[^a-zA-Z0-9\-_]/g, '_');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Rechnung_${safeName}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.send(pdf);
    } catch {
      res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
    }
  });

  function formatDateDE(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function fmtEur(num) {
    return num.toFixed(2).replace('.', ',') + ' EUR';
  }

  async function buildInvoicePdf(invoice, client, s) {
    let PDFDocument;
    try {
      PDFDocument = (await import('pdfkit')).default;
    } catch {
      throw new Error('PDF-Bibliothek (pdfkit) nicht verfügbar');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      // Register Unicode-capable font for German umlauts
      const unicodeFont = findUnicodeFont();
      if (unicodeFont) {
        doc.registerFont('Main', unicodeFont);
        doc.registerFont('Main-Bold', unicodeFont);
        const boldVariant = unicodeFont
          .replace('calibri.ttf', 'calibrib.ttf')
          .replace('arial.ttf', 'arialbd.ttf')
          .replace('segoeui.ttf', 'segoeuib.ttf')
          .replace('LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf')
          .replace('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf')
          .replace('FreeSans.ttf', 'FreeSansBold.ttf');
        try { if (existsSync(boldVariant)) doc.registerFont('Main-Bold', boldVariant); } catch { /* skip */ }
      }

      const F = unicodeFont ? 'Main' : 'Helvetica';
      const FB = unicodeFont ? 'Main-Bold' : 'Helvetica-Bold';
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageW = 595.28;
      const rightM = 50;
      const leftM = 50;
      const lineH = 15;
      const senderW = 225;
      const rightCol = pageW - rightM - senderW;
      let y;

      // --- Sender block (top right, right-aligned text) ---
      y = 50;
      doc.fontSize(10).font(F);
      const ro = { width: senderW, align: 'right' };
      if (s.company_name) { doc.text(s.company_name, rightCol, y, ro); y += lineH; }
      if (s.address_line1) { doc.text(s.address_line1, rightCol, y, ro); y += lineH; }
      if (s.address_line2) { doc.text(s.address_line2, rightCol, y, ro); y += lineH; }
      if (s.phone) { doc.text(`Tel: ${s.phone}`, rightCol, y, ro); y += lineH; }
      if (s.email) { doc.text(`E-Mail: ${s.email}`, rightCol, y, ro); y += lineH; }
      y += lineH;
      if (s.tax_number) { doc.text(`Steuernummer: ${s.tax_number}`, rightCol, y, ro); y += lineH; }
      y += lineH;
      doc.text(`Rechnungs-Nr: ${invoice.invoice_number}`, rightCol, y, ro); y += lineH;
      doc.text(`Rechnungsdatum: ${formatDateDE(invoice.date)}`, rightCol, y, ro); y += lineH;
      if (invoice.due_date) { doc.text(`Fälligkeitsdatum: ${formatDateDE(invoice.due_date)}`, rightCol, y, ro); y += lineH; }

      // --- Recipient block (left) ---
      let ry = 130;
      doc.fontSize(10).font(F);
      doc.text('An', leftM, ry); ry += lineH;
      doc.font(FB).text(client?.name || '', leftM, ry, { width: 250 }); ry += lineH;
      doc.font(F);
      if (client?.address_line1) { doc.text(client.address_line1, leftM, ry, { width: 250 }); ry += lineH; }
      if (client?.address_line2 && client.address_line2 !== client.address_line1) {
        doc.text(client.address_line2, leftM, ry, { width: 250 }); ry += lineH;
      }

      // --- Heading ---
      const headY = Math.max(y, ry) + 30;
      doc.fontSize(22).font(F).text('Rechnung', leftM, headY);

      // --- Intro ---
      let introY = headY + 40;
      doc.fontSize(10).font(F);
      doc.text('Sehr geehrte Damen und Herren,', leftM, introY, { width: 495 }); introY += lineH * 2;
      doc.text('ich erlaube mir, Ihnen folgende Positionen zu berechnen.', leftM, introY, { width: 495 }); introY += lineH * 2;

      // --- Table ---
      const cols = { pos: leftM, desc: leftM + 42, qty: 308, unit: 358, price: 415, total: 472 };
      const tableRight = pageW - rightM;
      const tableW = tableRight - leftM;
      const colW = {
        pos:   cols.desc  - cols.pos,
        desc:  cols.qty   - cols.desc,
        qty:   cols.unit  - cols.qty,
        unit:  cols.price - cols.unit,
        price: cols.total - cols.price,
        total: tableRight - cols.total,
      };

      function drawRowDividers(rowY, rowH) {
        doc.save().strokeColor('#cccccc').lineWidth(0.5);
        [cols.desc, cols.qty, cols.unit, cols.price, cols.total].forEach(x => {
          doc.moveTo(x, rowY).lineTo(x, rowY + rowH).stroke();
        });
        doc.restore();
      }

      let ty = introY + 10;
      const rowPadX = 4;

      // Header row
      const headerH = 18;
      doc.font(FB).fontSize(9);
      doc.rect(leftM, ty - 3, tableW, headerH).fillAndStroke('#f0f0f0', '#999999');
      doc.fillColor('#000000');
      doc.text('Pos.',        cols.pos   + rowPadX, ty, { width: colW.pos   - rowPadX, align: 'left' });
      doc.text('Bezeichnung', cols.desc  + rowPadX, ty, { width: colW.desc  - rowPadX, align: 'left' });
      doc.text('Menge',       cols.qty   + rowPadX, ty, { width: colW.qty   - rowPadX * 2, align: 'center' });
      doc.text('Einheit',     cols.unit  + rowPadX, ty, { width: colW.unit  - rowPadX, align: 'left' });
      doc.text('Einzelpreis', cols.price + rowPadX, ty, { width: colW.price - rowPadX, align: 'right' });
      doc.text('Gesamt',      cols.total + rowPadX, ty, { width: colW.total - rowPadX, align: 'right' });
      drawRowDividers(ty - 3, headerH);
      ty += headerH + 2;

      // Data rows
      doc.font(F).fontSize(9);
      invoice.items.forEach((item, idx) => {
        const descH = doc.heightOfString(item.description, { width: colW.desc - rowPadX });
        const rowH = Math.max(descH + 6, 18);
        if (ty + rowH > 760) { doc.addPage(); ty = 50; }
        const rowBg = idx % 2 === 1 ? '#f9f9f9' : '#ffffff';
        doc.rect(leftM, ty - 3, tableW, rowH).fillAndStroke(rowBg, '#999999');
        doc.fillColor('#000000');
        doc.text(String(idx + 1),                     cols.pos   + rowPadX, ty, { width: colW.pos   - rowPadX, align: 'left' });
        doc.text(item.description,                    cols.desc  + rowPadX, ty, { width: colW.desc  - rowPadX, align: 'left' });
        doc.text(String(item.hours).replace('.', ','), cols.qty  + rowPadX, ty, { width: colW.qty   - rowPadX * 2, align: 'center' });
        doc.text('Stunden',                           cols.unit  + rowPadX, ty, { width: colW.unit  - rowPadX, align: 'left' });
        doc.text(fmtEur(item.rate),                   cols.price + rowPadX, ty, { width: colW.price - rowPadX, align: 'right' });
        doc.text(fmtEur(item.amount),                 cols.total + rowPadX, ty, { width: colW.total - rowPadX, align: 'right' });
        drawRowDividers(ty - 3, rowH);
        ty += rowH;
      });

      // Summe row
      doc.font(FB).fontSize(9);
      const sumH = 20;
      doc.rect(leftM, ty - 3, tableW, sumH).fillAndStroke('#e8e8e8', '#999999');
      doc.fillColor('#000000');
      doc.text('Summe', cols.pos + rowPadX, ty, { width: colW.pos + colW.desc + colW.qty + colW.unit + colW.price - rowPadX });
      doc.text(fmtEur(invoice.total), cols.total + rowPadX, ty, { width: colW.total - rowPadX, align: 'right' });
      drawRowDividers(ty - 3, sumH);
      ty += sumH + 20;

      // Note
      doc.font(F).fontSize(9);
      const note = s.invoice_note || '';
      if (note) { doc.text(`Hinweis: ${note}`, leftM, ty, { width: 495 }); }

      // Footer — bank details at page bottom
      const bankLine = [s.bank_name, s.bank_bic ? `BIC ${s.bank_bic}` : '', s.bank_iban ? `IBAN ${s.bank_iban}` : ''].filter(Boolean).join(' | ');
      if (bankLine) {
        const savedBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.fontSize(8).text(`Bankverbindung: ${bankLine}`, leftM, doc.page.height - 30, { width: 495, align: 'center' });
        doc.page.margins.bottom = savedBottom;
      }

      doc.end();
    });
  }

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

  // Maps a Planio time entry to Loona entry fields.
  // If comments contain "Abgerechnet" → billed field; otherwise → description field.
  // Falls back to issueTitle when comment is empty (and not "abgerechnet").
  function mapEntryFields(te, issueTitle) {
    const comment = te.comments || '';
    const isAbgerechnet = /abgerechnet/i.test(comment);
    return {
      description: isAbgerechnet ? (te.activity?.name || '') : (comment || issueTitle || te.activity?.name || ''),
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

          const issueTitle = te.issue?.id ? (issues.find(i => i.id === te.issue.id)?.subject || null) : null;
          const { description, billed } = mapEntryFields(te, issueTitle);
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

  // === DATEN-EXPORT / IMPORT ===

  // GET /api/export  – gibt die gesamte Datenbank als unverschlüsseltes JSON zurück
  app.get('/api/export', (req, res) => {
    const data = loadData();
    const json = JSON.stringify(data, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="loona-export.json"');
    res.send(json);
  });

  // POST /api/import  – fügt Datensätze aus einem Import-JSON hinzu
  // Body: { data: <loona-export JSON>, conflicts: { clients, tickets, entries, invoices } }
  //   conflicts ist ein Objekt mit IDs als keys und "overwrite" | "skip" als Wert
  // Antwort: { conflicts: [...], imported: { clients, tickets, entries, invoices } }
  //   Wenn conflicts leer ist, wurden alle Datensätze importiert.
  //   Wenn conflicts nicht leer ist, muss der Client erneut mit gefülltem conflicts-Objekt senden.
  app.post('/api/import', (req, res) => {
    const incoming = req.body?.data;
    const conflictResolutions = req.body?.conflicts || {};

    if (!incoming || typeof incoming !== 'object') {
      return res.status(400).json({ error: 'Kein gültiges Import-Objekt übergeben.' });
    }

    const entities = ['clients', 'tickets', 'entries', 'invoices'];
    const current = loadData();

    // Konflikte ermitteln: IDs die bereits existieren und noch keine Auflösung haben
    const pendingConflicts = [];
    for (const entity of entities) {
      const incoming_items = incoming[entity] || [];
      const existing_ids = new Set((current[entity] || []).map(x => x.id));
      for (const item of incoming_items) {
        const key = `${entity}:${item.id}`;
        if (existing_ids.has(item.id) && !conflictResolutions[key]) {
          pendingConflicts.push({ entity, id: item.id, name: item.name || item.description || String(item.id) });
        }
      }
    }

    // Noch ungeklärte Konflikte → Frontend muss fragen
    if (pendingConflicts.length > 0) {
      return res.status(409).json({ conflicts: pendingConflicts });
    }

    // Import durchführen
    const imported = { clients: 0, tickets: 0, entries: 0, invoices: 0 };

    for (const entity of entities) {
      const incoming_items = incoming[entity] || [];
      const existing_ids = new Map((current[entity] || []).map(x => [x.id, true]));

      for (const item of incoming_items) {
        const key = `${entity}:${item.id}`;
        const resolution = conflictResolutions[key];

        if (existing_ids.has(item.id)) {
          if (resolution === 'overwrite') {
            const idx = current[entity].findIndex(x => x.id === item.id);
            if (idx !== -1) current[entity][idx] = item;
            imported[entity]++;
          }
          // 'skip' → nichts tun
        } else {
          current[entity].push(item);
          imported[entity]++;
        }
      }

      // nextId auf Maximum setzen damit keine Kollisionen entstehen
      const allIds = (current[entity] || []).map(x => x.id);
      if (allIds.length > 0) {
        const maxId = Math.max(...allIds);
        const entityKey = entity === 'invoices' ? 'invoices' : entity;
        if (current.nextId[entityKey] <= maxId) {
          current.nextId[entityKey] = maxId + 1;
        }
      }
    }

    // Settings aus Import übernehmen falls vorhanden und explizit gewünscht
    if (req.body?.import_settings && incoming.settings) {
      current.settings = { ...current.settings, ...incoming.settings };
    }

    saveData(current);
    res.json({ ok: true, imported });
  });

  // === VERSCHLÜSSELUNGSVERWALTUNG ===

  // Passwort setzen oder ändern (Datenbank wird (neu)verschlüsselt)
  app.post('/api/encryption', async (req, res) => {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ error: 'Kein Passwort angegeben.' });
    try {
      const data = loadData();
      const salt = randomBytes(32);
      const key = await deriveKey(password, salt);
      const json = JSON.stringify(data, null, 2);
      writeFileSync(dataFilePath, encryptWithKey(json, key, salt), 'utf-8');
      currentKey = key;
      currentSalt = salt;
      locked = false;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Verschlüsselung fehlgeschlagen: ${err.message}` });
    }
  });

  // Verschlüsselung deaktivieren (Datenbank wird im Klartext gespeichert)
  app.delete('/api/encryption', (req, res) => {
    try {
      const data = loadData();
      currentKey = null;
      currentSalt = null;
      locked = false;
      writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: `Entschlüsselung fehlgeschlagen: ${err.message}` });
    }
  });

  return app;
}

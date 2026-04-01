import { describe, it, expect, beforeEach, afterAll, vi, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DATA_FILE = join(__dirname, '..', 'loona-test-data.json');

let app;

function resetData(data) {
  const defaults = { clients: [], tickets: [], entries: [], nextId: { clients: 1, tickets: 1, entries: 1 } };
  writeFileSync(TEST_DATA_FILE, JSON.stringify(data || defaults, null, 2));
}

beforeEach(() => {
  resetData();
  app = createApp(TEST_DATA_FILE);
});

afterAll(() => {
  if (existsSync(TEST_DATA_FILE)) unlinkSync(TEST_DATA_FILE);
});

// =====================
// CLIENTS
// =====================
describe('Clients API', () => {
  it('GET /api/clients returns empty array initially', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/clients creates a client with default color', async () => {
    const res = await request(app).post('/api/clients').send({ name: 'Acme Corp' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 1, name: 'Acme Corp', color: '#6b1ae6' });
    expect(res.body.created_at).toBeDefined();
  });

  it('POST /api/clients creates a client with custom color', async () => {
    const res = await request(app).post('/api/clients').send({ name: 'Beta GmbH', color: '#ff0000' });
    expect(res.body).toMatchObject({ id: 1, name: 'Beta GmbH', color: '#ff0000' });
  });

  it('GET /api/clients returns clients sorted by name', async () => {
    await request(app).post('/api/clients').send({ name: 'Zebra' });
    await request(app).post('/api/clients').send({ name: 'Alpha' });
    const res = await request(app).get('/api/clients');
    expect(res.body[0].name).toBe('Alpha');
    expect(res.body[1].name).toBe('Zebra');
  });

  it('PUT /api/clients/:id updates a client', async () => {
    await request(app).post('/api/clients').send({ name: 'Old Name', color: '#aaa' });
    const res = await request(app).put('/api/clients/1').send({ name: 'New Name', color: '#bbb' });
    expect(res.body).toMatchObject({ id: 1, name: 'New Name', color: '#bbb' });
  });

  it('PUT /api/clients/:id returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/clients/999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('PUT /api/clients/:id preserves unchanged fields', async () => {
    await request(app).post('/api/clients').send({ name: 'Keep', color: '#123' });
    const res = await request(app).put('/api/clients/1').send({ name: 'Changed' });
    expect(res.body.color).toBe('#123');
  });

  it('DELETE /api/clients/:id removes client and cascades', async () => {
    await request(app).post('/api/clients').send({ name: 'ToDelete' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T-1', name: 'Ticket' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2 });

    await request(app).delete('/api/clients/1');

    const clients = await request(app).get('/api/clients');
    expect(clients.body).toEqual([]);
    const tickets = await request(app).get('/api/tickets');
    expect(tickets.body).toEqual([]);
    const entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body).toEqual([]);
  });

  it('POST /api/clients auto-increments ids', async () => {
    const r1 = await request(app).post('/api/clients').send({ name: 'A' });
    const r2 = await request(app).post('/api/clients').send({ name: 'B' });
    expect(r1.body.id).toBe(1);
    expect(r2.body.id).toBe(2);
  });
});

// =====================
// TICKETS
// =====================
describe('Tickets API', () => {
  beforeEach(async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'Client A', color: '#f00' });
    await request(app).post('/api/clients').send({ name: 'Client B', color: '#0f0' });
  });

  it('GET /api/tickets returns empty initially', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.body).toEqual([]);
  });

  it('POST /api/tickets creates a ticket with client info', async () => {
    const res = await request(app).post('/api/tickets').send({
      client_id: 1, reference: 'PROJ-001', name: 'Setup', description: 'Initial setup',
    });
    expect(res.body).toMatchObject({
      id: 1, client_id: 1, reference: 'PROJ-001', name: 'Setup',
      description: 'Initial setup', active: 1,
      client_name: 'Client A', client_color: '#f00',
    });
  });

  it('POST /api/tickets defaults description to empty', async () => {
    const res = await request(app).post('/api/tickets').send({
      client_id: 1, reference: 'T-1', name: 'Test',
    });
    expect(res.body.description).toBe('');
  });

  it('GET /api/tickets filters by client_id', async () => {
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'A-1', name: 'A' });
    await request(app).post('/api/tickets').send({ client_id: 2, reference: 'B-1', name: 'B' });
    const res = await request(app).get('/api/tickets?client_id=1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reference).toBe('A-1');
  });

  it('GET /api/tickets filters by active status', async () => {
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T-1', name: 'Active' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T-2', name: 'Inactive' });
    await request(app).put('/api/tickets/2').send({
      client_id: 1, reference: 'T-2', name: 'Inactive', active: 0,
    });
    const res = await request(app).get('/api/tickets?active=1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Active');
  });

  it('GET /api/tickets sorts by client name then reference', async () => {
    await request(app).post('/api/tickets').send({ client_id: 2, reference: 'Z-1', name: 'Z' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'A-2', name: 'A2' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'A-1', name: 'A1' });
    const res = await request(app).get('/api/tickets');
    expect(res.body.map(t => t.reference)).toEqual(['A-1', 'A-2', 'Z-1']);
  });

  it('PUT /api/tickets/:id updates a ticket', async () => {
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'OLD', name: 'Old' });
    const res = await request(app).put('/api/tickets/1').send({
      client_id: 1, reference: 'NEW', name: 'New', description: 'Updated', active: 1,
    });
    expect(res.body).toMatchObject({ reference: 'NEW', name: 'New', description: 'Updated' });
  });

  it('PUT /api/tickets/:id returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/tickets/999').send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/tickets/:id removes ticket and its entries', async () => {
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T-1', name: 'T' });
    await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-01-01', hours: 1, ticket_text: 'T-1',
    });
    await request(app).delete('/api/tickets/1');
    const tickets = await request(app).get('/api/tickets');
    expect(tickets.body).toEqual([]);
  });
});

// =====================
// TIME ENTRIES
// =====================
describe('Time Entries API', () => {
  beforeEach(async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'Client A', color: '#f00' });
    await request(app).post('/api/clients').send({ name: 'Client B', color: '#0f0' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'PROJ-001', name: 'Project One' });
  });

  it('POST /api/entries creates entry without ticket', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 4, description: 'Work',
    });
    expect(res.body).toMatchObject({
      client_id: 1, ticket_id: null, date: '2026-03-28', hours: 4,
      description: 'Work', billed: '', client_name: 'Client A',
    });
  });

  it('POST /api/entries creates entry with existing ticket via ticket_text', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 2, ticket_text: 'PROJ-001',
    });
    expect(res.body).toMatchObject({
      client_id: 1, ticket_id: 1, ticket_reference: 'PROJ-001',
    });
  });

  it('POST /api/entries matches ticket_text case-insensitively', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 1, ticket_text: 'proj-001',
    });
    expect(res.body.ticket_id).toBe(1);
  });

  it('POST /api/entries matches ticket by name as well', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 1, ticket_text: 'Project One',
    });
    expect(res.body.ticket_id).toBe(1);
  });

  it('POST /api/entries auto-creates ticket from unknown ticket_text', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 3, ticket_text: 'NEW-TICKET',
    });
    expect(res.body.ticket_reference).toBe('NEW-TICKET');
    expect(res.body.ticket_id).toBe(2); // id 1 was PROJ-001

    // Verify ticket was actually created
    const tickets = await request(app).get('/api/tickets?client_id=1');
    expect(tickets.body.find(t => t.reference === 'NEW-TICKET')).toBeTruthy();
  });

  it('POST /api/entries ignores empty ticket_text', async () => {
    const res = await request(app).post('/api/entries').send({
      client_id: 1, date: '2026-03-28', hours: 1, ticket_text: '  ',
    });
    expect(res.body.ticket_id).toBeNull();
  });

  it('GET /api/entries hides billed entries by default', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 1 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 2 });
    await request(app).put('/api/entries/1').send({ billed: 'Invoice #1' });

    const res = await request(app).get('/api/entries');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].hours).toBe(2);
  });

  it('GET /api/entries?show_billed=1 shows all entries', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 1 });
    await request(app).put('/api/entries/1').send({ billed: 'Invoice #1' });

    const res = await request(app).get('/api/entries?show_billed=1');
    expect(res.body).toHaveLength(1);
  });

  it('GET /api/entries filters by client_id', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 1 });
    await request(app).post('/api/entries').send({ client_id: 2, date: '2026-03-28', hours: 2 });

    const res = await request(app).get('/api/entries?client_id=2');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].client_id).toBe(2);
  });

  it('GET /api/entries filters by date range', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-06-15', hours: 2 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-12-31', hours: 3 });

    const res = await request(app).get('/api/entries?from=2026-03-01&to=2026-09-01');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].hours).toBe(2);
  });

  it('GET /api/entries sorts by date descending', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-01', hours: 2 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-02-01', hours: 3 });

    const res = await request(app).get('/api/entries');
    expect(res.body.map(e => e.date)).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
  });

  it('PUT /api/entries/:id updates an entry', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 1 });
    const res = await request(app).put('/api/entries/1').send({
      hours: 5, description: 'Updated', billed: 'Invoice #42',
    });
    expect(res.body).toMatchObject({ hours: 5, description: 'Updated', billed: 'Invoice #42' });
  });

  it('PUT /api/entries/:id returns 404 for unknown id', async () => {
    const res = await request(app).put('/api/entries/999').send({ hours: 1 });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/entries/:id removes an entry', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-03-28', hours: 1 });
    await request(app).delete('/api/entries/1');
    const res = await request(app).get('/api/entries');
    expect(res.body).toEqual([]);
  });
});

// =====================
// SUMMARY
// =====================
describe('Summary API', () => {
  beforeEach(async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'Client A', color: '#f00' });
    await request(app).post('/api/clients').send({ name: 'Client B', color: '#0f0' });
  });

  it('GET /api/entries/summary returns all clients with zero hours', async () => {
    const res = await request(app).get('/api/entries/summary');
    expect(res.body).toHaveLength(2);
    expect(res.body[0].total_hours).toBe(0);
    expect(res.body[0].entry_count).toBe(0);
  });

  it('GET /api/entries/summary counts unbilled hours per client', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 3 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-02', hours: 5 });
    await request(app).post('/api/entries').send({ client_id: 2, date: '2026-01-01', hours: 2 });

    const res = await request(app).get('/api/entries/summary');
    const clientA = res.body.find(s => s.client_name === 'Client A');
    const clientB = res.body.find(s => s.client_name === 'Client B');
    expect(clientA.total_hours).toBe(8);
    expect(clientA.entry_count).toBe(2);
    expect(clientB.total_hours).toBe(2);
    expect(clientB.entry_count).toBe(1);
  });

  it('GET /api/entries/summary excludes billed entries', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 5 });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-02', hours: 3 });
    await request(app).put('/api/entries/1').send({ billed: 'Invoice #1' });

    const res = await request(app).get('/api/entries/summary');
    const clientA = res.body.find(s => s.client_name === 'Client A');
    expect(clientA.total_hours).toBe(3);
    expect(clientA.entry_count).toBe(1);
  });

  it('GET /api/entries/summary sorts by total_hours descending', async () => {
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2 });
    await request(app).post('/api/entries').send({ client_id: 2, date: '2026-01-01', hours: 10 });

    const res = await request(app).get('/api/entries/summary');
    expect(res.body[0].client_name).toBe('Client B');
    expect(res.body[1].client_name).toBe('Client A');
  });
});

// =====================
// DATA MIGRATION
// =====================
describe('Data migration', () => {
  it('migrates entries without client_id using ticket lookup', async () => {
    resetData({
      clients: [{ id: 1, name: 'C', color: '#000', created_at: '' }],
      tickets: [{ id: 10, client_id: 1, reference: 'T', name: 'T', description: '', active: 1, created_at: '' }],
      entries: [{ id: 1, ticket_id: 10, date: '2026-01-01', hours: 1, description: '', billed: '', created_at: '' }],
      nextId: { clients: 2, tickets: 11, entries: 2 },
    });
    app = createApp(TEST_DATA_FILE);

    const res = await request(app).get('/api/entries?show_billed=1');
    expect(res.body[0].client_id).toBe(1);
    expect(res.body[0].client_name).toBe('C');
  });

  it('handles entries without client_id and without ticket_id', async () => {
    resetData({
      clients: [{ id: 1, name: 'C', color: '#000', created_at: '' }],
      tickets: [],
      entries: [{ id: 1, date: '2026-01-01', hours: 1, description: '', billed: '', created_at: '' }],
      nextId: { clients: 2, tickets: 1, entries: 2 },
    });
    app = createApp(TEST_DATA_FILE);

    const res = await request(app).get('/api/entries?show_billed=1');
    expect(res.body[0].client_id).toBeNull();
    expect(res.body[0].client_name).toBe('');
  });
});

// =====================
// EDGE CASES
// =====================
describe('Edge cases', () => {
  it('works with no data file (fresh start)', async () => {
    if (existsSync(TEST_DATA_FILE)) unlinkSync(TEST_DATA_FILE);
    app = createApp(TEST_DATA_FILE);

    const res = await request(app).get('/api/clients');
    expect(res.body).toEqual([]);
  });

  it('GET /api/entries filters by ticket_id', async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T1', name: 'T1' });
    await request(app).post('/api/tickets').send({ client_id: 1, reference: 'T2', name: 'T2' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1, ticket_text: 'T1' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2, ticket_text: 'T2' });

    const res = await request(app).get('/api/entries?ticket_id=1');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].ticket_reference).toBe('T1');
  });

  it('ticket auto-creation does not duplicate existing tickets', async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1, ticket_text: 'TASK-1' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-02', hours: 2, ticket_text: 'TASK-1' });

    const tickets = await request(app).get('/api/tickets');
    expect(tickets.body.filter(t => t.reference === 'TASK-1')).toHaveLength(1);
  });

  it('ticket auto-creation scopes to client', async () => {
    resetData();
    app = createApp(TEST_DATA_FILE);
    await request(app).post('/api/clients').send({ name: 'A' });
    await request(app).post('/api/clients').send({ name: 'B' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1, ticket_text: 'SAME' });
    await request(app).post('/api/entries').send({ client_id: 2, date: '2026-01-01', hours: 1, ticket_text: 'SAME' });

    const tickets = await request(app).get('/api/tickets');
    expect(tickets.body.filter(t => t.reference === 'SAME')).toHaveLength(2);
    expect(tickets.body[0].client_id).not.toBe(tickets.body[1].client_id);
  });

  it('enrichEntry resolves client from ticket for legacy entries', async () => {
    resetData({
      clients: [{ id: 1, name: 'C', color: '#abc', created_at: '' }],
      tickets: [{ id: 5, client_id: 1, reference: 'R', name: 'R', description: '', active: 1, created_at: '' }],
      entries: [{ id: 1, ticket_id: 5, date: '2026-01-01', hours: 1, description: '', billed: '', created_at: '' }],
      nextId: { clients: 2, tickets: 6, entries: 2 },
    });
    app = createApp(TEST_DATA_FILE);

    const summary = await request(app).get('/api/entries/summary');
    expect(summary.body[0].total_hours).toBe(1);
  });
});

// =====================
// PLANIO INTEGRATION
// =====================

const PLANIO_ISSUES = [
  { id: 101, subject: 'Bug Fix', description: 'Fix the thing', status: { id: 1, name: 'New', is_closed: false }, created_on: '2025-01-01T00:00:00Z' },
  { id: 102, subject: 'Feature', description: '', status: { id: 5, name: 'Closed', is_closed: true }, created_on: '2025-01-02T00:00:00Z' },
];
const PLANIO_ENTRIES = [
  { id: 201, issue: { id: 101 }, hours: 2.5, comments: 'Bugfix impl', activity: { name: 'Development' }, spent_on: '2025-06-01', created_on: '2025-06-01T10:00:00Z' },
  { id: 202, issue: { id: 101 }, hours: 1.0, comments: '', activity: { name: 'Testing' }, spent_on: '2025-06-02', created_on: '2025-06-02T10:00:00Z' },
  { id: 203, issue: { id: 101 }, hours: 0.5, comments: 'Abgerechnet Rechnung #42', activity: { name: 'Meeting' }, spent_on: '2025-06-03', created_on: '2025-06-03T10:00:00Z' },
];

function mockFetch(issues = PLANIO_ISSUES, entries = PLANIO_ENTRIES) {
  vi.stubGlobal('fetch', async (url) => {
    if (url.includes('/my/account.json')) {
      return { ok: true, json: async () => ({ user: { id: 42, login: 'testuser' } }) };
    }
    if (url.includes('/issues.json')) {
      return { ok: true, json: async () => ({ issues, total_count: issues.length }) };
    }
    if (url.includes('/time_entries.json')) {
      return { ok: true, json: async () => ({ time_entries: entries, total_count: entries.length }) };
    }
    return { ok: false, status: 404, statusText: 'Not Found' };
  });
}

describe('Planio API', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('PUT /api/clients/:id/planio saves planio config', async () => {
    await request(app).post('/api/clients').send({ name: 'Client A' });
    const res = await request(app).put('/api/clients/1/planio').send({
      planio_url: 'https://test.planio.com',
      planio_api_key: 'abc123',
    });
    expect(res.status).toBe(200);
    expect(res.body.planio_url).toBe('https://test.planio.com');
    expect(res.body.planio_api_key).toBe('abc123');
  });

  it('PUT /api/clients/:id/planio returns 404 for unknown client', async () => {
    const res = await request(app).put('/api/clients/999/planio').send({ planio_url: 'x', planio_api_key: 'y' });
    expect(res.status).toBe(404);
  });

  it('GET /api/planio/preview returns 404 for unknown client', async () => {
    const res = await request(app).get('/api/planio/preview?client_id=999');
    expect(res.status).toBe(404);
  });

  it('GET /api/planio/preview returns 400 when planio not configured', async () => {
    await request(app).post('/api/clients').send({ name: 'Client A' });
    const res = await request(app).get('/api/planio/preview?client_id=1');
    expect(res.status).toBe(400);
  });

  it('GET /api/planio/preview returns stats from Planio', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });

    const res = await request(app).get('/api/planio/preview?client_id=1');
    expect(res.status).toBe(200);
    expect(res.body.stats.total_issues).toBe(2);
    expect(res.body.stats.new_issues).toBe(2);
    expect(res.body.stats.total_entries).toBe(3);
    expect(res.body.stats.new_entries).toBe(3);
  });

  it('GET /api/planio/preview reports existing items as not-new', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });
    // Pre-seed an already-imported ticket
    resetData({
      version: 2,
      clients: [{ id: 1, name: 'Client A', color: '#fff', planio_url: 'https://t.planio.com', planio_api_key: 'k', created_at: '' }],
      tickets: [{ id: 1, client_id: 1, planio_id: 101, reference: '#101', name: 'Bug Fix', description: '', active: 1, created_at: '' }],
      entries: [],
      nextId: { clients: 2, tickets: 2, entries: 1 },
    });
    app = createApp(TEST_DATA_FILE);

    const res = await request(app).get('/api/planio/preview?client_id=1');
    expect(res.body.stats.new_issues).toBe(1); // only issue 102 is new
    expect(res.body.stats.new_entries).toBe(3);
  });

  it('GET /api/planio/preview returns 502 when fetch fails', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('ECONNREFUSED'); });
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });

    const res = await request(app).get('/api/planio/preview?client_id=1');
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Planio/);
  });

  it('POST /api/planio/import imports tickets only', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });

    const res = await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: true, import_entries: false });
    expect(res.status).toBe(200);
    expect(res.body.tickets_imported).toBe(2);
    expect(res.body.entries_imported).toBe(0);

    const tickets = await request(app).get('/api/tickets');
    expect(tickets.body).toHaveLength(2);
    expect(tickets.body.find(t => t.planio_id === 101).reference).toBe('#101');
    expect(tickets.body.find(t => t.planio_id === 102).active).toBe(0); // closed issue
  });

  it('POST /api/planio/import imports entries and auto-creates tickets', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });

    const res = await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: false, import_entries: true });
    expect(res.status).toBe(200);
    expect(res.body.entries_imported).toBe(3);
    // Ticket for issue 101 should have been auto-created
    expect(res.body.tickets_imported).toBe(1);

    const entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body).toHaveLength(3);
    const e1 = entries.body.find(e => e.planio_id === 201);
    expect(e1.hours).toBe(2.5);
    expect(e1.description).toBe('Bugfix impl');
    expect(e1.billed).toBe('');
    expect(e1.ticket_id).toBeGreaterThan(0);
  });

  it('POST /api/planio/import: "Abgerechnet" in comment goes to billed, not description', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });

    await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: false, import_entries: true });

    const entries = await request(app).get('/api/entries?show_billed=1');
    const e203 = entries.body.find(e => e.planio_id === 203);
    expect(e203.billed).toBe('Abgerechnet Rechnung #42');
    expect(e203.description).toBe('Meeting'); // activity name, not the comment
    // Billed entries should NOT appear in the default (unbilled) view
    const unbilled = await request(app).get('/api/entries');
    expect(unbilled.body.find(e => e.planio_id === 203)).toBeUndefined();
  });

  it('POST /api/planio/import: time entries filtered by current user (user_id param)', async () => {
    let capturedUrl = '';
    vi.stubGlobal('fetch', async (url) => {
      capturedUrl = url;
      if (url.includes('/my/account.json')) {
        return { ok: true, json: async () => ({ user: { id: 99 } }) };
      }
      if (url.includes('/issues.json')) {
        return { ok: true, json: async () => ({ issues: [], total_count: 0 }) };
      }
      if (url.includes('/time_entries.json')) {
        expect(url).toContain('user_id=99');
        return { ok: true, json: async () => ({ time_entries: [], total_count: 0 }) };
      }
      return { ok: false, status: 404, statusText: 'Not Found' };
    });

    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });
    await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: false, import_entries: true });
    expect(capturedUrl).toContain('user_id=99');
  });

  it('POST /api/planio/import skips already-imported items', async () => {
    mockFetch();
    await request(app).post('/api/clients').send({ name: 'Client A' });
    await request(app).put('/api/clients/1/planio').send({ planio_url: 'https://t.planio.com', planio_api_key: 'k' });
    // First import
    await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: true, import_entries: true });
    // Second import should import nothing new
    const res = await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: true, import_entries: true });
    expect(res.body.tickets_imported).toBe(0);
    expect(res.body.entries_imported).toBe(0);
    // Total should still be the original count
    const entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body).toHaveLength(3);
  });

  it('POST /api/planio/import returns 400 when planio not configured', async () => {
    await request(app).post('/api/clients').send({ name: 'Client A' });
    const res = await request(app).post('/api/planio/import').send({ client_id: 1, import_tickets: true, import_entries: false });
    expect(res.status).toBe(400);
  });
});

// =====================
// SETTINGS
// =====================
describe('Settings API', () => {
  it('GET /api/settings returns empty object initially', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('PUT /api/settings saves and returns settings', async () => {
    const settings = { company_name: 'Test GmbH', hourly_rate: 95, bank_iban: 'DE123' };
    const res = await request(app).put('/api/settings').send(settings);
    expect(res.status).toBe(200);
    expect(res.body.company_name).toBe('Test GmbH');
    expect(res.body.hourly_rate).toBe(95);
    expect(res.body.bank_iban).toBe('DE123');
  });

  it('PUT /api/settings merges with existing settings', async () => {
    await request(app).put('/api/settings').send({ company_name: 'A' });
    const res = await request(app).put('/api/settings').send({ hourly_rate: 100 });
    expect(res.body.company_name).toBe('A');
    expect(res.body.hourly_rate).toBe(100);
  });
});

// =====================
// INVOICES
// =====================
describe('Invoices API', () => {
  it('GET /api/invoices returns empty array initially', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/invoices/next-number returns default number', async () => {
    const res = await request(app).get('/api/invoices/next-number');
    expect(res.status).toBe(200);
    expect(res.body.next).toMatch(/^\d{10}$/);
  });

  it('POST /api/invoices creates invoice and marks entries as billed', async () => {
    // Setup: client + unbilled entries
    await request(app).post('/api/clients').send({ name: 'Client A', address_line1: 'Street 1', address_line2: '12345 City' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2, description: 'Work A' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-02', hours: 3, description: 'Work B' });

    const res = await request(app).post('/api/invoices').send({
      client_id: 1,
      invoice_number: '2026000001',
      date: '2026-01-15',
      due_date: '2026-01-29',
      hourly_rate: 100,
      entry_ids: [1, 2],
    });
    expect(res.status).toBe(200);
    expect(res.body.invoice_number).toBe('2026000001');
    expect(res.body.client_id).toBe(1);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(500); // 2*100 + 3*100

    // GET list enriches with client_name
    const list = await request(app).get('/api/invoices');
    expect(list.body[0].client_name).toBe('Client A');

    // Entries should now be billed
    const entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body[0].billed).toBe('2026000001');
    expect(entries.body[1].billed).toBe('2026000001');

    // Unbilled view should be empty
    const unbilled = await request(app).get('/api/entries');
    expect(unbilled.body).toHaveLength(0);
  });

  it('GET /api/invoices/next-number increments after creating invoice', async () => {
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: '2026000005', date: '2026-01-15', due_date: '2026-01-29', hourly_rate: 80, entry_ids: [1],
    });

    const res = await request(app).get('/api/invoices/next-number');
    expect(res.body.next).toBe('2026000006');
  });

  it('GET /api/invoices/next-number erkennt YYYY-NNNNN Format (mit Bindestrich)', async () => {
    const year = new Date().getFullYear().toString();
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: `${year}-01-01`, hours: 1 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: `${year}-00001`, date: `${year}-01-15`, due_date: `${year}-01-29`, hourly_rate: 80, entry_ids: [1],
    });

    const res = await request(app).get('/api/invoices/next-number');
    expect(res.body.next).toBe(`${year}-00002`);
  });

  it('GET /api/invoices/next-number setzt Zähler bei neuem Jahr zurück (YYYY-NNNNN Format)', async () => {
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: '2025-00042', date: '2026-01-15', due_date: '2026-01-29', hourly_rate: 80, entry_ids: [1],
    });

    const res = await request(app).get('/api/invoices/next-number');
    const year = new Date().getFullYear().toString();
    expect(res.body.next).toBe(year + '-00001');
  });

  it('YYYY-NNNNN Rechnungsnummer wird korrekt gespeichert und als billed gesetzt', async () => {
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: '2026-00003', date: '2026-01-15', hourly_rate: 80, entry_ids: [1],
    });

    const entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body[0].billed).toBe('2026-00003');
  });

  it('GET /api/invoices/:id returns single invoice', async () => {
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: 'R1', date: '2026-01-15', due_date: '2026-01-29', hourly_rate: 80, entry_ids: [1],
    });

    const res = await request(app).get('/api/invoices/1');
    expect(res.status).toBe(200);
    expect(res.body.invoice_number).toBe('R1');
  });

  it('GET /api/invoices/:id returns 404 for unknown invoice', async () => {
    const res = await request(app).get('/api/invoices/999');
    expect(res.status).toBe(404);
  });

  it('DELETE /api/invoices/:id removes invoice and unmarks entries', async () => {
    await request(app).post('/api/clients').send({ name: 'C' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 1 });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: 'DEL1', date: '2026-01-15', due_date: '2026-01-29', hourly_rate: 80, entry_ids: [1],
    });

    // Entry should be billed
    let entries = await request(app).get('/api/entries?show_billed=1');
    expect(entries.body[0].billed).toBe('DEL1');

    // Delete invoice
    const res = await request(app).delete('/api/invoices/1');
    expect(res.status).toBe(200);

    // Invoice gone
    const invoices = await request(app).get('/api/invoices');
    expect(invoices.body).toHaveLength(0);

    // Entry should be unbilled again
    entries = await request(app).get('/api/entries');
    expect(entries.body).toHaveLength(1);
    expect(entries.body[0].billed).toBe('');
  });

  it('GET /api/invoices/:id/pdf returns a PDF', async () => {
    await request(app).post('/api/clients').send({ name: 'PDF Client', address_line1: 'Teststr. 1', address_line2: '10115 Berlin' });
    await request(app).put('/api/settings').send({ company_name: 'Meine Firma', address_line1: 'Firmenstr. 5', address_line2: '80331 Muenchen', bank_iban: 'DE93999999990000000001', bank_bic: 'TESTDE88XXX', bank_name: 'Testbank AG' });
    await request(app).post('/api/entries').send({ client_id: 1, date: '2026-01-01', hours: 2, description: 'Dev work' });
    await request(app).post('/api/invoices').send({
      client_id: 1, invoice_number: 'PDF001', date: '2026-01-15', due_date: '2026-01-29', hourly_rate: 100, entry_ids: [1],
    });

    const res = await request(app).get('/api/invoices/1/pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/pdf/);
    expect(res.body.length).toBeGreaterThan(100);
  });

  it('POST /api/invoices returns 400 for missing fields', async () => {
    const res = await request(app).post('/api/invoices').send({ client_id: 1 });
    expect(res.status).toBe(400);
  });

  it('Client address fields are saved and returned', async () => {
    const res = await request(app).post('/api/clients').send({
      name: 'Addr Client', address_line1: 'Hauptstr. 10', address_line2: '50667 Koeln',
    });
    expect(res.body.address_line1).toBe('Hauptstr. 10');
    expect(res.body.address_line2).toBe('50667 Koeln');

    // Update
    const upd = await request(app).put('/api/clients/1').send({ name: 'Addr Client', address_line1: 'Neue Str. 5' });
    expect(upd.body.address_line1).toBe('Neue Str. 5');
  });
});

// =====================
// VERSCHLÜSSELUNG (passwortbasiert)
// =====================
const ENC_TEST_FILE = join(__dirname, '..', 'loona-test-enc.json');

describe('Status-Endpunkt', () => {
  it('GET /api/status gibt locked: false und encrypted: false zurück wenn keine Datei existiert', async () => {
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(res.body.encrypted).toBe(false);
  });
});

describe('Passwortbasierte Datei-Verschlüsselung', () => {
  beforeEach(() => {
    if (existsSync(ENC_TEST_FILE)) unlinkSync(ENC_TEST_FILE);
  });

  afterAll(() => {
    if (existsSync(ENC_TEST_FILE)) unlinkSync(ENC_TEST_FILE);
  });

  it('verschlüsselt die Datenbank nach POST /api/encryption', async () => {
    const encApp = createApp(ENC_TEST_FILE);
    await request(encApp).post('/api/clients').send({ name: 'Offen GmbH' });
    await request(encApp).post('/api/encryption').send({ password: 'sicheresPasswort123' });
    const raw = readFileSync(ENC_TEST_FILE, 'utf-8');
    expect(raw.startsWith('LOONA_ENC_PW_V1:')).toBe(true);
    expect(raw).not.toContain('Offen GmbH');
  });

  it('sperrt die App nach Server-Neustart wenn Datei verschlüsselt ist', async () => {
    const encApp = createApp(ENC_TEST_FILE);
    await request(encApp).post('/api/clients').send({ name: 'Test GmbH' });
    await request(encApp).post('/api/encryption').send({ password: 'sicheresPasswort123' });

    // Neue App-Instanz – muss gesperrt sein
    const lockedApp = createApp(ENC_TEST_FILE);
    const statusRes = await request(lockedApp).get('/api/status');
    expect(statusRes.body.locked).toBe(true);
    expect(statusRes.body.encrypted).toBe(true);

    // Normaler Zugriff verwehrt
    const clientsRes = await request(lockedApp).get('/api/clients');
    expect(clientsRes.status).toBe(503);
  });

  it('nicht-API-Routen werden bei gesperrter App nicht blockiert (Regression: lock-guard darf nur /api betreffen)', async () => {
    const encApp = createApp(ENC_TEST_FILE);
    await request(encApp).post('/api/clients').send({ name: 'Test GmbH' });
    await request(encApp).post('/api/encryption').send({ password: 'sicheresPasswort123' });

    const lockedApp = createApp(ENC_TEST_FILE);

    // /api/* muss gesperrt sein
    const apiRes = await request(lockedApp).get('/api/clients');
    expect(apiRes.status).toBe(503);

    // Nicht-API-Routen dürfen nie 503 zurückgeben – der React-Build muss ladbar bleiben.
    // Im Test-Environment gibt es kein dist/-Verzeichnis, daher 404 statt 200, aber nie 503.
    const rootRes = await request(lockedApp).get('/');
    expect(rootRes.status).toBe(404);
    expect(rootRes.text).not.toContain('locked');

    const assetRes = await request(lockedApp).get('/assets/index.js');
    expect(assetRes.status).toBe(404);
    expect(assetRes.text).not.toContain('locked');
  });

  it('entsperrt mit korrektem Passwort und verweigert mit falschem', async () => {
    const encApp = createApp(ENC_TEST_FILE);
    await request(encApp).post('/api/clients').send({ name: 'Test GmbH' });
    await request(encApp).post('/api/encryption').send({ password: 'sicheresPasswort123' });

    const lockedApp = createApp(ENC_TEST_FILE);

    // Falsches Passwort
    const failRes = await request(lockedApp).post('/api/unlock').send({ password: 'falsch' });
    expect(failRes.status).toBe(401);

    // Richtiges Passwort
    const okRes = await request(lockedApp).post('/api/unlock').send({ password: 'sicheresPasswort123' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.ok).toBe(true);

    // Jetzt Zugriff möglich
    const clientsRes = await request(lockedApp).get('/api/clients');
    expect(clientsRes.status).toBe(200);
    expect(clientsRes.body[0].name).toBe('Test GmbH');
  });

  it('deaktiviert Verschlüsselung via DELETE /api/encryption', async () => {
    const encApp = createApp(ENC_TEST_FILE);
    await request(encApp).post('/api/clients').send({ name: 'Secret GmbH' });
    await request(encApp).post('/api/encryption').send({ password: 'sicheresPasswort123' });

    // Entsperren und dann Verschlüsselung entfernen
    const unlockedApp = createApp(ENC_TEST_FILE);
    await request(unlockedApp).post('/api/unlock').send({ password: 'sicheresPasswort123' });
    await request(unlockedApp).delete('/api/encryption');

    const raw = readFileSync(ENC_TEST_FILE, 'utf-8');
    expect(raw.startsWith('LOONA_ENC_PW_V1:')).toBe(false);
    const parsed = JSON.parse(raw);
    expect(parsed.clients[0].name).toBe('Secret GmbH');
  });
});


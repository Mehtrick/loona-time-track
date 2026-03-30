# Loona – Zeiterfassungs-App

Loona ist eine plattformübergreifende **Desktop-App (Electron)** für freiberufliche Zeiterfassung, Rechnungserstellung und Planio/Redmine-Import. Daten werden lokal als JSON-Datei gespeichert – kein Cloud-Zugriff, keine Datenbank.

## Sprache & Auslieferung

- **Alle Texte, Labels, Fehlermeldungen und Kommentare sind auf Deutsch** – keine englischen UI-Strings
- **Die App wird als Electron-Desktop-Anwendung ausgeliefert** – kein Browser-Deployment, kein Server-Hosting
- Electron-spezifische Einschränkungen immer beachten: kein `window.open`, keine nativen Browser-APIs ohne Polyfill, Datei-I/O läuft über den Express-Backend-Prozess (port 3001)
- `src/api.ts` erkennt automatisch ob die App im Electron- oder Browser-Dev-Modus läuft (Port-Parameter vs. Vite-Proxy)

## Architektur

| Schicht | Pfad | Hinweise |
|---------|------|----------|
| Frontend | `src/` | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | `server/` | Express.js REST API auf Port 3001 |
| Desktop-Wrapper | `electron/` | Electron 41, electron-builder |
| Gemeinsame Typen | `src/types.ts` | `Client`, `Ticket`, `TimeEntry`, `PlanioStats` usw. |
| API-Client | `src/api.ts` | Fetch-basiert, unterstützt Electron-Port-Parameter + Vite-Proxy |
| Persistenz | `loona-data.json` | JSON-Datei, Schema versioniert (aktuell v3) |

## Build & Test

```bash
npm run dev              # Frontend (Vite :5173) + Backend (Express :3001) gleichzeitig
npm run electron:dev     # Vollständiger Electron-Desktop-Dev-Modus
npm run build            # Produktions-Vite-Build → dist/
npm run electron:build   # Vollständiger Desktop-Build (Icon + Frontend + electron-builder)
npm run test             # Vitest (alle Tests)
npm run test:coverage    # Coverage-Report
```

## Konventionen

### Frontend (src/)
- **Funktionale React-Komponenten** mit Hooks – keine Klassenkomponenten
- **Routing**: React Router v6 – Routen verwenden deutsche Slugs: `/erfassen`, `/buchungen`, `/tickets`, `/kunden`, `/abrechnungen`, `/einstellungen`
- **Styling**: Tailwind CSS mit eigenen Theme-Tokens – `night-900`, `night-950`, `loona-300`, `loona-600`, `loona-glow` statt generischer Tailwind-Farben verwenden
- **Typen**: Immer aus `src/types.ts` importieren – Typen nicht lokal neu definieren
- **UI-Sprache**: Deutsch – alle Labels, Meldungen und Navigation auf Deutsch

### Backend (server/app.js)
- RESTful Express API – bestehende Endpunkt-Muster verwenden
- Persistenz ausschließlich über `loadData()` / `saveData()` Hilfsfunktionen in eine JSON-Datei
- **Datenmigration**: Neue Schema-Änderungen als versionierte Migrationsfunktionen hinzufügen (Version hochzählen, Migrationsschritt ergänzen) – bestehende Daten nicht beschädigen
- ID-Sequenzierung über `nextId`-Objekt – bestehendes Muster bei neuen Entity-Typen übernehmen

### Tests (server/app.test.js)
- Vitest + Supertest für HTTP-Integrationstests gegen die Express-App
- Temporäre JSON-Dateien für Testdaten-Isolation verwenden – `loona-data.json` in Tests nie verändern

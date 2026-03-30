<div align="center">
  <img src="public/loona.svg" width="72" alt="Loona Logo" />

  # Loona – Zeiterfassung

  **Einfache Zeiterfassung für Freelancer.** Stunden buchen, Kunden und Tickets verwalten, PDF-Rechnungen erstellen – als native Desktop-App für Windows, macOS und Linux.

  [![CI](https://github.com/Mehtrick/loona-time-track/actions/workflows/ci.yml/badge.svg)](https://github.com/Mehtrick/loona-time-track/actions/workflows/ci.yml)
  [![Release](https://img.shields.io/github/v/release/Mehtrick/loona-time-track)](https://github.com/Mehtrick/loona-time-track/releases)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## Features

- 📊 **Dashboard** — Live-Überblick über offene Stunden und letzte Buchungen je Kunde
- ⏱️ **Stunden erfassen** — Schnelleingabe mit One-Click-Presets (0,5h · 1h · 2h · 4h · 6h · 8h)
- 📋 **Buchungen** — Alle Einträge filtern, einsehen und abrechnen
- 🎫 **Tickets** — Arbeitsaufgaben je Kunde strukturieren und verwalten
- 👥 **Kunden** — Kunden mit Farbkennung und Rechnungsanschrift pflegen
- 🧾 **Abrechnungen** — Professionelle PDF-Rechnungen mit optionaler Obergrenze erstellen
- 🔗 **Planio-Import** — Tickets und Buchungen aus Planio/Redmine importieren
- ⚙️ **Einstellungen** — Geschäftsdaten, Bankverbindung, Stundensatz und Rechnungshinweis
- 💾 **Lokale Datenhaltung** — Alle Daten als verschlüsselte Datei (AES-256-GCM), kein Cloud-Konto erforderlich
- 🖥️ **Plattformübergreifend** — Windows, macOS (Intel + Apple Silicon) und Linux

---

## Screenshots

| Dashboard | Stunden erfassen |
|:---------:|:----------------:|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Erfassen](docs/screenshots/erfassen.png) |

| Buchungen | Tickets |
|:---------:|:-------:|
| ![Buchungen](docs/screenshots/buchungen.png) | ![Tickets](docs/screenshots/tickets.png) |

| Kunden | Abrechnungen |
|:------:|:------------:|
| ![Kunden](docs/screenshots/kunden.png) | ![Abrechnungen](docs/screenshots/abrechnungen.png) |

<div align="center">

![Einstellungen](docs/screenshots/einstellungen.png)

</div>

---

## Download

Lade die aktuelle Version für dein Betriebssystem von der [Releases-Seite](https://github.com/Mehtrick/loona-time-track/releases) herunter:

| Plattform | Datei |
|-----------|-------|
| **Windows** | `Loona-Setup-X.X.X.exe` — NSIS-Installer (wählbarer Installationspfad) |
| **macOS** | `Loona-X.X.X.dmg` — Universal (Intel + Apple Silicon) |
| **Linux** | `Loona-X.X.X.AppImage` — Läuft auf allen gängigen Distributionen |

---

## Erster Start

Beim ersten Start fragt Loona, wo deine Datendatei (`loona-data.json`) gespeichert werden soll. Der Standard ist das Benutzer-Datenverzeichnis (`%APPDATA%\loona\` auf Windows). Den Pfad kannst du jederzeit über das Menü ändern:

> **Loona → Datenpfad ändern…**

Den aktuell verwendeten Pfad siehst du unter **Loona → Aktuellen Datenpfad anzeigen**.

Alle Daten werden ausschließlich lokal gespeichert – keine Cloud, kein Konto.

---

## Datensicherheit & Verschlüsselung

Loona verschlüsselt die Datendatei automatisch mit **AES-256-GCM** (authentifizierte Verschlüsselung). Die Daten auf der Festplatte sind dadurch für Dritte ohne den passenden Schlüssel nicht lesbar.

### Schlüsselverwaltung

Der Verschlüsselungsschlüssel wird beim ersten Start zufällig generiert und sicher in der **OS-Keychain** abgelegt:

| Plattform | Speicherort |
|-----------|-------------|
| **Windows** | Windows Credential Store (über Electron `safeStorage`) |
| **macOS** | macOS Keychain (über Electron `safeStorage`) |
| **Linux** | libsecret / GNOME Keyring – Fallback auf `loona.key` im App-Datenverzeichnis |

> **Hinweis:** Bei einem Umzug auf einen anderen Rechner muss die Datendatei zusammen mit dem Schlüssel migriert werden. Ohne den passenden Schlüssel können die Daten nicht entschlüsselt werden. Erstelle daher regelmäßig Backups deines App-Datenverzeichnisses.

### Migration bestehender (unverschlüsselter) Daten

Wer von einer Loona-Version vor Einführung der Verschlüsselung aktualisiert, muss nichts tun. Loona erkennt beim Start automatisch unverschlüsselte Dateien und verschlüsselt sie sofort – die Daten bleiben vollständig erhalten.

---

## Entwicklung

### Voraussetzungen

- Node.js 20+
- npm 10+

### Setup

```bash
git clone https://github.com/Mehtrick/loona-time-track.git
cd loona
npm install
```

### Im Browser starten (ohne Electron)

```bash
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
```

### Als Electron-App starten

```bash
npm run electron:dev
```

### Tests ausführen

```bash
npm test

# Mit Coverage-Report
npm run test:coverage
```

---

## Build

### Desktop-App für die aktuelle Plattform bauen

```bash
npm run electron:build
```

Die Ausgabe landet im Ordner `release/`.

### Release veröffentlichen

Einfach ein Git-Tag erstellen und pushen — GitHub Actions übernimmt den Rest:

```bash
git tag v1.2.0
git push origin v1.2.0
```

Der Release-Workflow baut automatisch Installer für Windows, macOS und Linux und hängt sie an das GitHub Release an. Die Versionsnummer im Client wird dabei automatisch aus dem Tag übernommen.

---

## Tech Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite 6 |
| Backend | Express.js (eingebettet), JSON-Datei-Speicher |
| Desktop | Electron 41, electron-builder |
| PDF-Generierung | pdfkit |
| Tests | Vitest, Supertest (>97 % Coverage) |

---

## Konfiguration vor dem ersten GitHub-Upload

Passe den `build.publish`-Block in `package.json` an:

```json
"publish": {
  "provider": "github",
  "owner": "Mehtrick",
  "repo": "loona"
}
```

Ersetze auch alle Vorkommen von `Mehtrick` in dieser README durch deinen tatsächlichen GitHub-Nutzernamen.

---

## Lizenz

MIT

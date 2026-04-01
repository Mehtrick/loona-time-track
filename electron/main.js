import { app, BrowserWindow, dialog, Menu, ipcMain, safeStorage } from 'electron';
import { createApp } from '../server/app.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import { randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

// Settings management
const settingsPath = join(app.getPath('userData'), 'loona-settings.json');

function loadSettings() {
  if (!existsSync(settingsPath)) return {};
  try {
    return JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  const dir = dirname(settingsPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

let mainWindow = null;
let server = null;
let serverPort = null;
let encryptionKey = null;

/**
 * Lädt den Verschlüsselungsschlüssel aus den Settings (via safeStorage / OS-Keychain)
 * oder aus einer Fallback-Schlüsseldatei. Generiert einen neuen Schlüssel beim ersten Start.
 * settings wird ggf. mit dem neuen Key-Eintrag befüllt (Aufrufer muss dann saveSettings aufrufen).
 */
function loadOrCreateEncryptionKey(settings) {
  const keyFilePath = join(app.getPath('userData'), 'loona.key');

  if (safeStorage.isEncryptionAvailable()) {
    if (settings.encryptionKey) {
      try {
        const encryptedBuf = Buffer.from(settings.encryptionKey, 'base64');
        const keyHex = safeStorage.decryptString(encryptedBuf);
        return Buffer.from(keyHex, 'hex');
      } catch {
        // Schlüssel beschädigt oder anderer Rechner — neuen generieren
      }
    }
    const key = randomBytes(32);
    settings.encryptionKey = safeStorage.encryptString(key.toString('hex')).toString('base64');
    return key;
  }

  // Fallback: Schlüsseldatei (falls safeStorage nicht verfügbar, z. B. auf manchen Linux-Systemen)
  if (existsSync(keyFilePath)) {
    try {
      return Buffer.from(readFileSync(keyFilePath, 'utf-8').trim(), 'hex');
    } catch {
      // Beschädigte Datei — neuen Schlüssel generieren
    }
  }
  const key = randomBytes(32);
  writeFileSync(keyFilePath, key.toString('hex'), 'utf-8');
  return key;
}

function getDefaultDataPath() {
  return join(app.getPath('userData'), 'loona-data.json');
}

async function askForDataPath(parentWindow, isFirstStart = false) {
  const defaultPath = getDefaultDataPath();
  const defaultDir = dirname(defaultPath);

  if (isFirstStart) {
    await dialog.showMessageBox(parentWindow || null, {
      type: 'info',
      title: 'Willkommen bei Loona 🌙',
      message: 'Willkommen bei Loona – deiner persönlichen Zeiterfassung!',
      detail:
        'Loona speichert alle deine Daten lokal auf deinem Rechner – ' +
        'keine Cloud, kein Server, alles bei dir.\n\n' +
        'Bitte wähle im nächsten Schritt einen Ordner, in dem Loona ' +
        'deine Zeiteinträge, Kunden und Tickets ablegen soll.\n\n' +
        'Tipp: Wähle einen Ordner, der regelmäßig gesichert wird ' +
        '(z. B. in deiner Dropbox oder auf einem Netzlaufwerk), ' +
        'damit deine Daten sicher sind.',
      buttons: ['Weiter'],
      defaultId: 0,
    });
  }

  const result = await dialog.showOpenDialog(parentWindow || null, {
    title: 'Loona – Datenspeicherort wählen',
    message: 'Wähle den Ordner, in dem Loona deine Daten speichern soll.',
    defaultPath: defaultDir,
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Ordner auswählen',
  });

  if (result.canceled || !result.filePaths.length) {
    return defaultPath;
  }

  return join(result.filePaths[0], 'loona-data.json');
}

function startServer(dataPath) {
  if (server) {
    server.close();
  }

  const expressApp = createApp(dataPath, encryptionKey);

  // Serve built frontend in production
  if (!isDev) {
    const distPath = join(__dirname, '..', 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(join(distPath, 'index.html'));
    });
  }

  return new Promise((resolve) => {
    server = expressApp.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      console.log(`🌙 Loona Server auf Port ${serverPort}`);
      resolve(serverPort);
    });
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Loona',
    icon: join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#090c17',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // In dev mode, load from Vite dev server with port injected
    mainWindow.loadURL(`http://localhost:5173?port=${port}`);
  } else {
    // In production, load from built files served by Express
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Remove default menu bar in production
  if (!isDev) {
    mainWindow.setMenuBarVisibility(false);
  }
}

function buildMenu() {
  const template = [
    {
      label: 'Loona',
      submenu: [
        {
          label: 'Datenpfad ändern...',
          click: async () => {
            const newPath = await askForDataPath(mainWindow);
            const settings = loadSettings();
            const oldPath = settings.dataPath;

            if (newPath !== oldPath) {
              settings.dataPath = newPath;
              saveSettings(settings);

              // Restart server with new path
              const port = await startServer(newPath);

              // Reload window
              if (isDev) {
                mainWindow.loadURL(`http://localhost:5173?port=${port}`);
              } else {
                mainWindow.loadURL(`http://127.0.0.1:${port}`);
              }

              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Datenpfad geändert',
                message: `Loona speichert jetzt unter:\n${newPath}`,
              });
            }
          },
        },
        {
          label: 'Aktuellen Datenpfad anzeigen',
          click: () => {
            const settings = loadSettings();
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Datenpfad',
              message: `Daten werden gespeichert unter:\n${settings.dataPath || getDefaultDataPath()}`,
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Entwicklertools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
          visible: isDev,
        },
        { type: 'separator' },
        { label: 'Beenden', role: 'quit' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', role: 'undo' },
        { label: 'Wiederholen', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', role: 'cut' },
        { label: 'Kopieren', role: 'copy' },
        { label: 'Einfügen', role: 'paste' },
        { label: 'Alles auswählen', role: 'selectAll' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', role: 'reload' },
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' },
        { label: 'Originalgröße', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  const settings = loadSettings();

  // Verschlüsselungsschlüssel laden oder neu generieren (vor dem ersten Server-Start)
  encryptionKey = loadOrCreateEncryptionKey(settings);
  saveSettings(settings);

  let dataPath = settings.dataPath;

  // First start: show welcome dialog then ask for data path
  if (!dataPath) {
    dataPath = await askForDataPath(null, true);
    settings.dataPath = dataPath;
    saveSettings(settings);
  }

  // Ensure directory exists
  const dataDir = dirname(dataPath);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const port = await startServer(dataPath);
  buildMenu();
  createWindow(port);
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});

// === AUTO-UPDATER ===
// Dynamischer Import: electron-updater ist ein CJS-Paket dessen autoUpdater
// nur über den default-Export erreichbar ist. Lazy-Import verhindert außerdem
// Fehler im Dev-Modus, wo electron-updater keine app-update.yml findet.
async function setupAutoUpdater() {
  if (isDev) return; // Kein Update-Check im Dev-Modus

  let autoUpdater;
  try {
    const updaterModule = await import('electron-updater');
    autoUpdater = updaterModule.default?.autoUpdater ?? updaterModule.autoUpdater;
    if (!autoUpdater) throw new Error('autoUpdater nicht gefunden');
  } catch (err) {
    console.error('electron-updater konnte nicht geladen werden:', err.message);
    return;
  }

  autoUpdater.autoDownload = false; // Erst fragen, dann laden

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update verfügbar',
      message: `Loona ${info.version} ist verfügbar!`,
      detail:
        'Eine neue Version von Loona steht bereit. ' +
        'Möchtest du jetzt aktualisieren?\n\n' +
        'Das Update wird im Hintergrund heruntergeladen ' +
        'und beim nächsten Start installiert.',
      buttons: ['Jetzt herunterladen', 'Später'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.downloadUpdate();
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update bereit',
      message: 'Update heruntergeladen',
      detail: 'Das Update wurde heruntergeladen. Loona wird jetzt neu gestartet und aktualisiert.',
      buttons: ['Jetzt neu starten', 'Später'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('Update-Fehler:', err);
  });

  autoUpdater.checkForUpdates();
}

app.on('activate', () => {
  if (mainWindow === null && serverPort) {
    createWindow(serverPort);
  }
});

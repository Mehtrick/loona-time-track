import { app, BrowserWindow, dialog, Menu, ipcMain } from 'electron';
import { createApp } from '../server/app.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

// Settings management
const settingsPath = join(app.getPath('userData'), 'luna-settings.json');

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

function getDefaultDataPath() {
  return join(app.getPath('userData'), 'luna-data.json');
}

async function askForDataPath(parentWindow) {
  const defaultPath = getDefaultDataPath();
  const defaultDir = dirname(defaultPath);

  const result = await dialog.showOpenDialog(parentWindow || null, {
    title: 'Luna - Datenspeicherort wählen',
    message: 'Wähle den Ordner, in dem Luna deine Daten speichern soll.',
    defaultPath: defaultDir,
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Ordner auswählen',
  });

  if (result.canceled || !result.filePaths.length) {
    return defaultPath;
  }

  return join(result.filePaths[0], 'luna-data.json');
}

function startServer(dataPath) {
  if (server) {
    server.close();
  }

  const expressApp = createApp(dataPath);

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
      console.log(`🌙 Luna Server auf Port ${serverPort}`);
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
    title: 'Luna',
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
      label: 'Luna',
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
                message: `Luna speichert jetzt unter:\n${newPath}`,
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
  let dataPath = settings.dataPath;

  // First start: ask for data path
  if (!dataPath) {
    dataPath = await askForDataPath(null);
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
});

app.on('window-all-closed', () => {
  if (server) server.close();
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null && serverPort) {
    createWindow(serverPort);
  }
});

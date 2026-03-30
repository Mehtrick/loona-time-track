import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApp } from './app.js';
import express from 'express';
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataFile = join(__dirname, '..', 'loona-data.json');
const keyFile = join(__dirname, '..', 'loona-data.key');

function loadOrCreateKey() {
  if (existsSync(keyFile)) {
    try {
      return Buffer.from(readFileSync(keyFile, 'utf-8').trim(), 'hex');
    } catch {
      console.warn('⚠️  Schl\u00fcsseldatei besch\u00e4digt – neuer Schl\u00fcssel wird generiert.');
    }
  }
  const key = randomBytes(32);
  writeFileSync(keyFile, key.toString('hex'), 'utf-8');
  console.log(`\uD83D\uDD11 Neuer Verschl\u00fcsselungsschl\u00fcssel gespeichert in: ${keyFile}`);
  return key;
}

const encryptionKey = loadOrCreateKey();
const app = createApp(dataFile, encryptionKey);

// Serve built frontend only when dist/ exists (production standalone mode)
const distPath = join(__dirname, '..', 'dist');
if (existsSync(join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌙 Loona Server läuft auf http://localhost:${PORT}`);
});

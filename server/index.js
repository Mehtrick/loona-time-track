import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createApp } from './app.js';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataFile = join(__dirname, '..', 'luna-data.json');
const app = createApp(dataFile);

// Serve built frontend only when dist/ exists (production standalone mode)
import { existsSync } from 'fs';
const distPath = join(__dirname, '..', 'dist');
if (existsSync(join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌙 Luna Server läuft auf http://localhost:${PORT}`);
});

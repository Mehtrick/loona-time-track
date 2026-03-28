// Waits for Vite dev server to be ready, then starts Electron
import { exec } from 'child_process';

const VITE_URL = 'http://localhost:5173';
const MAX_RETRIES = 30;

async function waitForVite(retries = 0) {
  try {
    await fetch(VITE_URL);
    return true;
  } catch {
    if (retries >= MAX_RETRIES) {
      console.error('Vite dev server not ready after 30 seconds');
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 1000));
    return waitForVite(retries + 1);
  }
}

console.log('Warte auf Vite dev server...');
await waitForVite();
console.log('Vite bereit, starte Electron...');

const electron = exec('npx electron .', { stdio: 'inherit' });
electron.stdout?.pipe(process.stdout);
electron.stderr?.pipe(process.stderr);
electron.on('close', () => process.exit());

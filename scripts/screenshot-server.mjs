import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots')

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (req.method === 'POST' && req.url.startsWith('/save/')) {
    const filename = decodeURIComponent(req.url.slice(6))
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      const base64 = body.replace(/^data:image\/png;base64,/, '')
      const buffer = Buffer.from(base64, 'base64')
      const dest = path.join(OUT_DIR, filename)
      fs.writeFileSync(dest, buffer)
      console.log('Saved:', dest)
      res.writeHead(200)
      res.end('OK')
    })
  } else {
    res.writeHead(404); res.end()
  }
})

server.listen(3099, () => console.log('Screenshot receiver running on :3099'))

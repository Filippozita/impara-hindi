// Piccolo server per provare l'app sul computer:  node strumenti/server.mjs
// Poi apri http://localhost:5173  (nessuna dipendenza da installare).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const PORTA = Number(process.env.PORT) || 5173;
const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

createServer(async (richiesta, risposta) => {
  let percorso = decodeURIComponent(new URL(richiesta.url, 'http://x').pathname);
  if (percorso.endsWith('/')) percorso += 'index.html';
  const file = normalize(join(RADICE, percorso));
  if (!file.startsWith(RADICE)) {
    risposta.writeHead(403).end();
    return;
  }
  try {
    const dati = await readFile(file);
    risposta.writeHead(200, { 'Content-Type': TIPI[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    risposta.end(dati);
  } catch (e) {
    risposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Non trovato');
  }
}).listen(PORTA, () => console.log(`App in ascolto su http://localhost:${PORTA}`));

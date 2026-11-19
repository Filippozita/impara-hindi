// sw.js — service worker: tiene una copia dell'app sul telefono, così funziona offline.
//
// Strategia "prima la rete":
//  - all'installazione scarica tutti i file dell'app;
//  - a ogni apertura prova a prendere i file aggiornati dalla rete e aggiorna la copia salvata,
//    così le novità si vedono subito, senza dover chiudere e riaprire;
//  - se la rete manca, o non risponde entro ATTESA_MS, usa la copia salvata.
//
// Se aggiungi o rinomini un file dell'app, aggiornalo nell'elenco FILE e cambia VERSIONE.

const VERSIONE = 'v10';
const CACHE = 'impara-hindi-' + VERSIONE;
const ATTESA_MS = 2500;
const FILE = [
  './',
  './index.html',
  './contenuti.json',
  './manifest.webmanifest',
  './css/stile.css',
  './js/app.js',
  './js/audio.js',
  './js/dati.js',
  './js/lezione.js',
  './js/schermate.js',
  './js/stato.js',
  './js/ui.js',
  './js/voce.js',
  './icone/icona-192.png',
  './icone/icona-512.png',
  './icone/icona-maskable-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (evento) => {
  // Elimina le copie delle versioni precedenti.
  evento.waitUntil(
    caches
      .keys()
      .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith('impara-hindi-') && n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

/** Scarica dalla rete e aggiorna la copia salvata. */
async function scaricaEAggiorna(richiesta) {
  const risposta = await fetch(richiesta, { cache: 'no-cache' });
  if (risposta.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(richiesta, risposta.clone());
  }
  return risposta;
}

/** Rifiuta se la promessa non si conclude entro `ms` (la promessa continua comunque in sottofondo). */
function entro(promessa, ms) {
  return new Promise((risolvi, rifiuta) => {
    const timer = setTimeout(() => rifiuta(new Error('rete lenta')), ms);
    promessa.then(
      (valore) => {
        clearTimeout(timer);
        risolvi(valore);
      },
      (errore) => {
        clearTimeout(timer);
        rifiuta(errore);
      },
    );
  });
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  const url = new URL(richiesta.url);
  if (richiesta.method !== 'GET' || url.origin !== self.location.origin) return;

  const dallaRete = scaricaEAggiorna(richiesta);
  // Anche se si risponde con la copia salvata, lo scaricamento prosegue e la aggiorna.
  evento.waitUntil(dallaRete.catch(() => {}));
  evento.respondWith(
    entro(dallaRete, ATTESA_MS)
      .catch(() => caches.match(richiesta, { ignoreSearch: true }))
      .then((risposta) => risposta || dallaRete),
  );
});

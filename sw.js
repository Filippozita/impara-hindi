// sw.js — service worker: tiene una copia dell'app sul telefono, così funziona offline.
//
// Strategia:
//  - all'installazione scarica tutti i file dell'app;
//  - contenuti.json: prima la rete (così i nuovi livelli arrivano subito), poi la copia salvata;
//  - tutto il resto: subito la copia salvata, e intanto si aggiorna in sottofondo
//    (le modifiche al codice si vedono alla seconda apertura).
//
// Se aggiungi o rinomini un file dell'app, aggiornalo nell'elenco FILE e cambia VERSIONE.

const VERSIONE = 'v5';
const CACHE = 'impara-hindi-' + VERSIONE;
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

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  const url = new URL(richiesta.url);
  if (richiesta.method !== 'GET' || url.origin !== self.location.origin) return;

  // Contenuti: rete prima, copia salvata se si è offline.
  if (url.pathname.endsWith('/contenuti.json')) {
    evento.respondWith(scaricaEAggiorna(richiesta).catch(() => caches.match(richiesta, { ignoreSearch: true })));
    return;
  }

  // Tutto il resto: copia salvata subito, aggiornamento in sottofondo.
  evento.respondWith(
    caches.match(richiesta, { ignoreSearch: true }).then((salvata) => {
      const dallaRete = scaricaEAggiorna(richiesta).catch(() => salvata);
      if (salvata) {
        evento.waitUntil(dallaRete);
        return salvata;
      }
      return dallaRete;
    }),
  );
});

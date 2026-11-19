// app.js — avvio dell'app, navigazione tra le schermate (tramite l'hash dell'indirizzo),
// tema, conteggio del tempo e registrazione del service worker per l'uso offline.

import * as stato from './stato.js';
import * as dati from './dati.js';
import { zittisci, quandoCambiaVoce } from './audio.js';
import { preparaDizionario } from './voce.js';
import { h, icona, vai } from './ui.js';
import { avviaLezione, avviaRipasso } from './lezione.js';
import * as schermate from './schermate.js';

const radice = document.getElementById('app');
const nav = document.getElementById('nav');
const striscia = document.getElementById('striscia');
let pulizia = null; // funzione da chiamare quando si lascia la schermata corrente

// ---------- Tema ----------

function applicaTema() {
  const tema = stato.leggi().impostazioni.tema;
  if (tema === 'chiaro' || tema === 'scuro') document.documentElement.dataset.tema = tema;
  else delete document.documentElement.dataset.tema;
  // La barra del browser prende il colore dello sfondo.
  const sfondo = getComputedStyle(document.documentElement).getPropertyValue('--forte').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && sfondo) meta.setAttribute('content', sfondo);
}

// ---------- Barra di navigazione in basso ----------

const VOCI_NAV = [
  ['', 'Home', 'casa'],
  ['livelli', 'Lezioni', 'libro'],
  ['da-ripassare', 'Ripasso', 'ripeti'],
  ['progressi', 'Progressi', 'grafico'],
  ['altro', 'Altro', 'altro'],
];

function disegnaNav(percorso) {
  const inLista = dati.vociInListaRipasso().length;
  nav.replaceChildren(
    ...VOCI_NAV.map(([dove, nome, simbolo]) => {
      const attiva = percorso === dove || (dove === 'altro' && percorso === 'come-si-legge') || (dove === 'livelli' && percorso === 'dispensa');
      return h(
        'a',
        { href: '#/' + dove, class: attiva ? 'attiva' : '', 'aria-current': attiva ? 'page' : null },
        icona(simbolo),
        h('span', {}, nome),
        dove === 'da-ripassare' && inLista > 0 ? h('span', { class: 'pallino' }, String(inLista)) : null,
      );
    }),
  );
}

// ---------- Striscia dei progressi (sempre visibile) ----------

function disegnaStriscia() {
  const tutte = dati.tutteLeVoci();
  const totale = tutte.length || 1;
  const studiate = tutte.filter((v) => stato.leggiVoce(v.id).scatola >= 1).length;
  const imparate = dati.vociImparate().length;
  const daFare = dati.vociDaRipassareOggi().length;
  const oggi = stato.statisticheOggi();
  striscia.replaceChildren(
    h('span', { class: 'striscia-pezzo', title: 'Giorni di fila' }, icona('fuoco'), String(stato.giorniDiFila())),
    h(
      'span',
      { class: 'striscia-centro' },
      h('span', { class: 'striscia-testo' }, h('strong', {}, `${studiate} di ${tutte.length}`), ` studiate · ${imparate} imparate · ${oggi.minuti} min oggi`),
      // Barra a due toni: chiaro = studiate, pieno = imparate.
      h('span', { class: 'barra-doppia' }, h('span', { class: 'barra-studiate', style: `width:${(studiate / totale) * 100}%` }), h('span', { class: 'barra-imparate', style: `width:${(imparate / totale) * 100}%` })),
    ),
    h('span', { class: 'striscia-pezzo', title: 'Da ripassare oggi' }, icona('ripeti'), String(daFare)),
  );
}

// ---------- Navigazione ----------

function mostra() {
  if (pulizia) pulizia();
  pulizia = null;
  zittisci();
  const [percorso, parametro] = window.location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  let aTuttoSchermo = false;
  radice.replaceChildren();
  window.scrollTo(0, 0);

  switch (percorso) {
    case 'lezione': {
      const trovata = dati.trovaLezione(parametro);
      const indice = trovata ? dati.tuttiILivelli().indexOf(trovata.livello) : -1;
      if (!trovata || !dati.livelloSbloccato(indice)) {
        vai('livelli');
        return;
      }
      aTuttoSchermo = true;
      pulizia = avviaLezione(radice, trovata);
      break;
    }
    case 'ripasso':
      aTuttoSchermo = true;
      pulizia = avviaRipasso(radice, dati.vociDaRipassareOggi(), { titolo: 'Ripasso di oggi' });
      break;
    case 'ripasso-lista':
      aTuttoSchermo = true;
      pulizia = avviaRipasso(radice, dati.vociInListaRipasso(), { titolo: 'Da ripassare' });
      break;
    case 'ripasso-capitolo': {
      const trovato = dati.trovaCapitolo(parametro);
      if (!trovato) {
        vai('livelli');
        return;
      }
      aTuttoSchermo = true;
      // Si ripassano le voci già studiate; se non ce ne sono ancora, tutte.
      const studiate = trovato.capitolo.voci.filter((v) => stato.leggiVoce(v.id).scatola >= 1);
      pulizia = avviaRipasso(radice, studiate.length > 0 ? studiate : trovato.capitolo.voci, { titolo: 'Ripasso: ' + trovato.capitolo.titolo, ritorno: 'livelli' });
      break;
    }
    case 'dispensa':
      schermate.dispensa(radice, parametro);
      break;
    case 'livelli':
      schermate.livelli(radice);
      break;
    case 'da-ripassare':
      schermate.daRipassare(radice);
      break;
    case 'progressi':
      schermate.progressi(radice);
      break;
    case 'come-si-legge':
      schermate.comeSiLegge(radice);
      break;
    case 'altro':
      schermate.altro(radice, { applicaTema });
      break;
    default:
      schermate.home(radice);
  }

  document.body.classList.toggle('tutto-schermo', aTuttoSchermo);
  disegnaStriscia();
  if (!aTuttoSchermo) disegnaNav(percorso || '');
}

// ---------- Tempo di studio ----------

// Ogni 5 secondi con l'app in primo piano si aggiungono 5 secondi al totale di oggi.
function contaTempo() {
  let daSalvare = 0;
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    stato.aggiungiSecondi(5);
    daSalvare += 5;
    if (daSalvare >= 15) {
      stato.salva();
      daSalvare = 0;
    }
  }, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stato.salva();
  });
}

// ---------- Avvio ----------

async function avvia() {
  stato.carica();
  applicaTema();
  try {
    await dati.caricaContenuti();
  } catch (e) {
    radice.replaceChildren(
      h('div', { class: 'scheda vuota' }, h('p', {}, 'Non riesco a caricare i contenuti.'), h('p', { class: 'suggerimento' }, 'Controlla la connessione e riapri l\'app: dopo la prima apertura funziona anche offline.'), h('button', { class: 'btn btn-primario', type: 'button', onclick: () => window.location.reload() }, 'Riprova')),
    );
    return;
  }
  preparaDizionario(dati.tutteLeVoci());
  window.addEventListener('hashchange', mostra);
  // Liste e contatori cambiati (import, azzeramento…): si ridisegna la barra in basso.
  window.addEventListener('progressi-cambiati', () => {
    disegnaStriscia();
    if (!document.body.classList.contains('tutto-schermo')) disegnaNav(window.location.hash.replace(/^#\/?/, '').split('/')[0]);
  });
  // Quando il telefono comunica le voci disponibili, la home aggiorna l'avviso sulla voce hindi.
  quandoCambiaVoce(() => {
    if (window.location.hash.replace(/^#\/?/, '') === '') schermate.home(radice);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applicaTema);
  mostra();
  contaTempo();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* senza service worker l'app funziona lo stesso, solo non offline */
    });
  }
}

avvia();

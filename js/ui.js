// ui.js — piccoli mattoni condivisi dalle schermate: creazione di elementi, icone,
// pulsanti audio, segnalibro "da ripassare", avvisi a comparsa.

import * as stato from './stato.js';
import { parla } from './audio.js';

/**
 * Crea un elemento. Esempio: h('button', { class: 'btn', onclick: f }, 'Testo')
 * Gli attributi che iniziano per "on" diventano ascoltatori di eventi; i figli null vengono ignorati.
 */
export function h(tag, attributi = {}, ...figli) {
  const el = document.createElement(tag);
  for (const [nome, valore] of Object.entries(attributi || {})) {
    if (valore === null || valore === undefined || valore === false) continue;
    if (nome.startsWith('on')) el.addEventListener(nome.slice(2), valore);
    else if (nome === 'class') el.className = valore;
    else el.setAttribute(nome, valore === true ? '' : valore);
  }
  for (const figlio of figli.flat()) {
    if (figlio === null || figlio === undefined || figlio === false) continue;
    el.append(figlio instanceof Node ? figlio : document.createTextNode(String(figlio)));
  }
  return el;
}

// Icone al tratto (disegnate a mano, 24×24).
const TRACCIATI = {
  audio: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9.5 9.5 0 0 1 0 13"/>',
  lento: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/>',
  segna: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  casa: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
  libro: '<path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14"/>',
  ripeti: '<path d="M4 11a8 8 0 0 1 14-4l2 2M20 4v5h-5M20 13a8 8 0 0 1-14 4l-2-2M4 20v-5h5"/>',
  grafico: '<path d="M5 20V11M12 20V4M19 20v-7M2 20h20"/>',
  altro: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  chiudi: '<path d="M6 6l12 12M18 6 6 18"/>',
  ok: '<path d="M4 12l5 5L20 6"/>',
  lucchetto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  freccia: '<path d="M9 5l7 7-7 7"/>',
  fuoco: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
  stella: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
};

export function icona(nome) {
  const span = document.createElement('span');
  span.className = 'icona';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TRACCIATI[nome] || ''}</svg>`;
  return span;
}

export function vai(percorso) {
  window.location.hash = '#/' + percorso;
}

/** I due pulsanti audio di una voce: velocità normale e lenta. */
export function pulsantiAudio(voce, { compatti = false } = {}) {
  return h(
    'div',
    { class: 'audio' + (compatti ? ' audio-compatti' : '') },
    h('button', { class: 'btn btn-audio', type: 'button', 'aria-label': 'Ascolta', onclick: () => parla(voce.devanagari, false) }, icona('audio'), compatti ? null : 'Ascolta'),
    h('button', { class: 'btn btn-audio btn-lento', type: 'button', 'aria-label': 'Ascolta lentamente', onclick: () => parla(voce.devanagari, true) }, icona('lento'), compatti ? null : 'Lento'),
  );
}

/** Segnalibro: mette o toglie a mano la voce dalla lista "Da ripassare". */
export function segnalibro(voce) {
  const bottone = h('button', { class: 'btn-segna', type: 'button' }, icona('segna'), h('span', {}, ''));
  const aggiorna = () => {
    const attivo = stato.leggiVoce(voce.id).segnata;
    bottone.setAttribute('aria-pressed', String(attivo));
    bottone.querySelector('span:last-child').textContent = attivo ? 'Segnata da ripassare' : 'Segna da ripassare';
  };
  bottone.addEventListener('click', () => {
    stato.cambiaSegnata(voce.id);
    aggiorna();
  });
  aggiorna();
  return bottone;
}

/** Barra di avanzamento (valore tra 0 e 1). */
export function barra(valore, etichetta) {
  const pct = Math.round(Math.max(0, Math.min(1, valore)) * 100);
  return h(
    'div',
    { class: 'barra', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': etichetta || 'Avanzamento' },
    h('div', { class: 'barra-piena', style: `width:${pct}%` }),
  );
}

let timerAvviso = null;

/** Messaggio breve in fondo allo schermo. */
export function avviso(testo) {
  let el = document.getElementById('avviso');
  if (!el) {
    el = h('div', { id: 'avviso', role: 'status' });
    document.body.append(el);
  }
  el.textContent = testo;
  el.classList.add('visibile');
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(() => el.classList.remove('visibile'), 2600);
}

/** Mescola una copia dell'elenco (Fisher–Yates). */
export function mescola(elenco) {
  const copia = [...elenco];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Sostituisce il contenuto di un elemento, ignorando i figli vuoti (null, false). */
export function metti(el, ...figli) {
  el.replaceChildren(...figli.flat().filter((f) => f !== null && f !== undefined && f !== false));
}

/** Piccola vibrazione di conferma (dove il telefono la consente). */
export function vibra(schema) {
  try {
    if (navigator.vibrate) navigator.vibrate(schema);
  } catch (e) {
    /* non disponibile: pazienza */
  }
}

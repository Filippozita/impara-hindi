// dati.js — carica contenuti.json e offre le domande più comuni sui contenuti e sui progressi.
// Tutto ciò che riguarda livelli, lezioni e voci passa da qui: il resto dell'app non conosce il file.

import * as stato from './stato.js';

let livelli = [];
let glossario = {}; // parola traslitterata → significato italiano
const vociPerId = new Map();
const lezioniPerId = new Map();

/** Percentuale minima del livello precedente per sbloccare il successivo. */
export const SOGLIA_SBLOCCO = 0.8;

/** Quante voci al massimo in una mini-lezione: poche, così si ricordano. */
export const MAX_VOCI_PER_LEZIONE = 3;

/**
 * Spezza una lezione dei contenuti in parti da al massimo MAX_VOCI_PER_LEZIONE voci,
 * il più possibile uguali (10 voci → 3, 3, 2, 2). Ogni parte è una lezione a sé, con id
 * "idOriginale~numero"; la spiegazione resta sulla prima parte.
 */
function dividi(lezione) {
  const voci = lezione.voci || [];
  const parti = Math.ceil(voci.length / MAX_VOCI_PER_LEZIONE);
  if (parti <= 1) return [lezione];
  const risultato = [];
  let inizio = 0;
  for (let k = 0; k < parti; k++) {
    const quante = Math.ceil((voci.length - inizio) / (parti - k));
    risultato.push({
      id: `${lezione.id}~${k + 1}`,
      origine: lezione.id,
      titolo: `${lezione.titolo} ${k + 1}/${parti}`,
      spiegazione: k === 0 ? lezione.spiegazione : undefined,
      voci: voci.slice(inizio, inizio + quante),
    });
    inizio += quante;
  }
  return risultato;
}

/** Una mini-lezione è fatta se è stata completata lei, oppure (prima della divisione) la lezione intera. */
export const lezioneFatta = (lezione) => stato.lezioneCompletata(lezione.id) || Boolean(lezione.origine && stato.lezioneCompletata(lezione.origine));

export async function caricaContenuti() {
  const risposta = await fetch('./contenuti.json');
  if (!risposta.ok) throw new Error('Impossibile caricare i contenuti.');
  const dati = await risposta.json();
  livelli = Array.isArray(dati.livelli) ? dati.livelli : [];
  // Le lezioni dei contenuti vengono spezzate in mini-lezioni da poche voci.
  livelli = livelli.map((livello) => ({ ...livello, lezioni: (livello.lezioni || []).flatMap(dividi) }));
  glossario = dati.glossario && typeof dati.glossario === 'object' ? dati.glossario : {};
  vociPerId.clear();
  lezioniPerId.clear();
  for (const livello of livelli) {
    for (const lezione of livello.lezioni || []) {
      lezioniPerId.set(lezione.id, { lezione, livello });
      for (const voce of lezione.voci || []) vociPerId.set(voce.id, voce);
    }
  }
}

export const tuttiILivelli = () => livelli;
export const tutteLeVoci = () => [...vociPerId.values()];
export const voce = (id) => vociPerId.get(id);
export const trovaLezione = (id) => lezioniPerId.get(id); // → { lezione, livello } oppure undefined
export const vociDelLivello = (livello) => livello.lezioni.flatMap((l) => l.voci);

/** Quota (0–1) delle voci del livello già studiate almeno una volta. */
export function avanzamentoLivello(livello) {
  const voci = vociDelLivello(livello);
  if (voci.length === 0) return 1;
  const studiate = voci.filter((v) => stato.leggiVoce(v.id).scatola >= 1).length;
  return studiate / voci.length;
}

/** Il primo livello è sempre aperto; gli altri quando il precedente è almeno all'80%. */
export function livelloSbloccato(indice) {
  if (indice <= 0) return true;
  // Un livello con "aperto": true nei contenuti è sempre disponibile.
  if (livelli[indice] && livelli[indice].aperto === true) return true;
  return livelloSbloccato(indice - 1) && avanzamentoLivello(livelli[indice - 1]) >= SOGLIA_SBLOCCO;
}

/** La prossima lezione non ancora completata tra i livelli sbloccati. */
export function prossimaLezione() {
  for (let i = 0; i < livelli.length; i++) {
    if (!livelloSbloccato(i)) break;
    for (const lezione of livelli[i].lezioni) {
      if (!lezioneFatta(lezione)) return { lezione, livello: livelli[i] };
    }
  }
  return null;
}

/** La lezione che viene dopo quella indicata (anche nel livello successivo, se sbloccato). */
export function lezioneSuccessiva(idLezione) {
  const elenco = [];
  livelli.forEach((livello, i) => {
    if (livelloSbloccato(i)) livello.lezioni.forEach((lezione) => elenco.push({ lezione, livello }));
  });
  const pos = elenco.findIndex((x) => x.lezione.id === idLezione);
  return pos >= 0 && pos + 1 < elenco.length ? elenco[pos + 1] : null;
}

export const vociDaRipassareOggi = () => tutteLeVoci().filter((v) => stato.daRipassareOggi(v.id));
export const vociInListaRipasso = () => tutteLeVoci().filter((v) => stato.inListaRipasso(v.id));
export const vociImparate = () => tutteLeVoci().filter((v) => stato.leggiVoce(v.id).scatola >= stato.SCATOLA_IMPARATA);

/** Divide un testo in parole, senza punteggiatura. */
const inParole = (testo) => testo.replace(/[?!.,;:।]/g, ' ').trim().split(/\s+/).filter(Boolean);

/**
 * Scompone una frase parola per parola: [{ translit, it, devanagari }].
 * Il significato viene dal campo "parole" della voce (se c'è) oppure dal glossario generale.
 * Restituisce null per le voci di una sola parola o se non c'è nessun significato da mostrare.
 */
export function scomposizione(voce) {
  const latine = inParole(voce.translit);
  if (latine.length < 2) return null;
  const hindi = inParole(voce.devanagari);
  const pezzi = latine.map((parola, i) => {
    const chiave = parola.toLowerCase();
    return {
      translit: parola,
      it: (voce.parole && voce.parole[chiave]) || glossario[chiave] || '',
      // L'audio della singola parola è disponibile solo se le due scritture hanno le stesse parole.
      devanagari: hindi.length === latine.length ? hindi[i] : '',
    };
  });
  return pezzi.some((p) => p.it) ? pezzi : null;
}

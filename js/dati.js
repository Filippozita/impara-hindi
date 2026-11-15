// dati.js — carica contenuti.json e offre le domande più comuni sui contenuti e sui progressi.
// Tutto ciò che riguarda livelli, lezioni e voci passa da qui: il resto dell'app non conosce il file.

import * as stato from './stato.js';

let livelli = [];
const vociPerId = new Map();
const lezioniPerId = new Map();

/** Percentuale minima del livello precedente per sbloccare il successivo. */
export const SOGLIA_SBLOCCO = 0.8;

export async function caricaContenuti() {
  const risposta = await fetch('./contenuti.json');
  if (!risposta.ok) throw new Error('Impossibile caricare i contenuti.');
  const dati = await risposta.json();
  livelli = Array.isArray(dati.livelli) ? dati.livelli : [];
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
  return livelloSbloccato(indice - 1) && avanzamentoLivello(livelli[indice - 1]) >= SOGLIA_SBLOCCO;
}

/** La prossima lezione non ancora completata tra i livelli sbloccati. */
export function prossimaLezione() {
  for (let i = 0; i < livelli.length; i++) {
    if (!livelloSbloccato(i)) break;
    for (const lezione of livelli[i].lezioni) {
      if (!stato.lezioneCompletata(lezione.id)) return { lezione, livello: livelli[i] };
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

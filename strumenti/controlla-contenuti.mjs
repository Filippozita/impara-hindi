// Controlla contenuti.json prima della pubblicazione:  node strumenti/controlla-contenuti.mjs
// Segnala gli errori più facili da fare aggiungendo voci a mano.

import { readFileSync } from 'node:fs';

const DEVANAGARI = /[ऀ-ॿ]/;
const errori = [];
let dati;
try {
  dati = JSON.parse(readFileSync(new URL('../contenuti.json', import.meta.url), 'utf8'));
} catch (e) {
  console.error('contenuti.json non è un JSON valido: ' + e.message);
  process.exit(1);
}

const idVisti = new Set();
const unico = (id, cosa) => {
  if (!id) errori.push(`${cosa}: manca "id"`);
  else if (idVisti.has(id)) errori.push(`id ripetuto: ${id}`);
  idVisti.add(id);
};

const glossario = dati.glossario || {};
const inParole = (t) => String(t).toLowerCase().replace(/[?!.,;:]/g, ' ').trim().split(/\s+/).filter(Boolean);
const senzaSignificato = new Set();

let totale = 0;
for (const livello of dati.livelli || []) {
  unico(livello.id, 'livello');
  if (!livello.titolo) errori.push(`livello ${livello.id}: manca "titolo"`);
  for (const lezione of livello.lezioni || []) {
    unico(lezione.id, 'lezione');
    if (!lezione.titolo) errori.push(`lezione ${lezione.id}: manca "titolo"`);
    const voci = lezione.voci || [];
    // Dispensa: le celle si vedono (niente devanagari), "audio" è il testo letto dalla voce.
    if (lezione.dispensa) {
      const p = lezione.dispensa;
      if (!Array.isArray(p.colonne) || !Array.isArray(p.righe)) errori.push(`dispensa di ${lezione.id}: servono "colonne" e "righe"`);
      for (const riga of p.righe || []) {
        if (!Array.isArray(riga.celle) || riga.celle.length < 2) errori.push(`dispensa di ${lezione.id}: ogni riga ha almeno due celle`);
        if (DEVANAGARI.test((riga.celle || []).join(' '))) errori.push(`dispensa di ${lezione.id}: devanagari in una cella visibile`);
        if (riga.audio && !DEVANAGARI.test(riga.audio)) errori.push(`dispensa di ${lezione.id}: "audio" deve essere in devanagari`);
      }
      if (DEVANAGARI.test((p.note || []).join(' ') + (p.titolo || ''))) errori.push(`dispensa di ${lezione.id}: devanagari nel titolo o nelle note`);
    }
    if (voci.length < 4) errori.push(`lezione ${lezione.id}: servono almeno 4 voci (per le 4 risposte del quiz)`);
    for (const voce of voci) {
      totale += 1;
      unico(voce.id, 'voce');
      for (const campo of ['it', 'translit', 'devanagari']) {
        if (!voce[campo]) errori.push(`voce ${voce.id}: manca "${campo}"`);
      }
      if (!['parola', 'frase'].includes(voce.tipo)) errori.push(`voce ${voce.id}: "tipo" deve essere "parola" o "frase"`);
      // Il devanagari non deve mai finire nei campi mostrati a schermo.
      if (DEVANAGARI.test(`${voce.it}${voce.translit}${voce.nota || ''}`)) errori.push(`voce ${voce.id}: devanagari in un campo visibile`);
      // "Parola per parola": le due scritture devono avere le stesse parole, ognuna con un significato.
      const latine = inParole(voce.translit || '');
      if (latine.length > 1) {
        if (inParole(voce.devanagari || '').length !== latine.length) errori.push(`voce ${voce.id}: translit e devanagari hanno un numero diverso di parole`);
        for (const parola of latine) if (!glossario[parola] && !(voce.parole && voce.parole[parola])) senzaSignificato.add(parola);
      }
      if (voce.devanagari && !DEVANAGARI.test(voce.devanagari)) errori.push(`voce ${voce.id}: il campo "devanagari" non contiene devanagari`);
    }
  }
}

if (senzaSignificato.size > 0) errori.push('parole senza significato nel "glossario": ' + [...senzaSignificato].join(', '));

if (errori.length > 0) {
  console.error(`contenuti.json: ${errori.length} problemi\n- ` + errori.join('\n- '));
  process.exit(1);
}
console.log(`contenuti.json a posto: ${(dati.livelli || []).length} livelli, ${totale} voci.`);

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

let totale = 0;
for (const livello of dati.livelli || []) {
  unico(livello.id, 'livello');
  if (!livello.titolo) errori.push(`livello ${livello.id}: manca "titolo"`);
  for (const lezione of livello.lezioni || []) {
    unico(lezione.id, 'lezione');
    if (!lezione.titolo) errori.push(`lezione ${lezione.id}: manca "titolo"`);
    const voci = lezione.voci || [];
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
      if (voce.devanagari && !DEVANAGARI.test(voce.devanagari)) errori.push(`voce ${voce.id}: il campo "devanagari" non contiene devanagari`);
    }
  }
}

if (errori.length > 0) {
  console.error(`contenuti.json: ${errori.length} problemi\n- ` + errori.join('\n- '));
  process.exit(1);
}
console.log(`contenuti.json a posto: ${(dati.livelli || []).length} livelli, ${totale} voci.`);

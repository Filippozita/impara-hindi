// audio.js — sintesi vocale del telefono (speechSynthesis) con una voce hindi.
// Il testo letto è sempre quello in devanagari (nascosto a schermo): suona molto meglio.

const supportata = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voceHindi = null;
let elencoArrivato = false; // il telefono ci ha già detto quali voci ha?
const ascoltatori = new Set();

function cercaVoce() {
  const voci = window.speechSynthesis.getVoices();
  if (voci.length > 0) elencoArrivato = true;
  // Meglio una voce locale (funziona offline), altrimenti la prima hindi disponibile.
  const hindi = voci.filter((v) => /^hi([-_]|$)/i.test(v.lang));
  voceHindi = hindi.find((v) => v.localService) || hindi[0] || null;
  ascoltatori.forEach((f) => f());
}

if (supportata) {
  cercaVoce();
  // Su Android l'elenco delle voci arriva in ritardo: si riprova quando cambia.
  window.speechSynthesis.addEventListener('voiceschanged', cercaVoce);
  setTimeout(cercaVoce, 1500);
}

/**
 * Stato della voce hindi:
 *  "ok"             → c'è una voce hindi
 *  "mancante"       → il telefono ha delle voci, ma nessuna hindi
 *  "sconosciuto"    → il telefono non ha (ancora) comunicato l'elenco: si prova lo stesso
 *  "non-supportato" → il browser non ha la sintesi vocale
 */
export function statoVoceHindi() {
  if (!supportata) return 'non-supportato';
  if (voceHindi) return 'ok';
  return elencoArrivato ? 'mancante' : 'sconosciuto';
}

/** L'audio può essere usato negli esercizi di ascolto? */
export const audioUtilizzabile = () => ['ok', 'sconosciuto'].includes(statoVoceHindi());

/** Avvisa quando lo stato della voce cambia (l'elenco arriva dopo l'avvio). */
export function quandoCambiaVoce(funzione) {
  ascoltatori.add(funzione);
  return () => ascoltatori.delete(funzione);
}

/** Legge un testo in hindi. `lento` dimezza circa la velocità. */
export function parla(testoDevanagari, lento = false) {
  if (!supportata || !testoDevanagari) return;
  const sintesi = window.speechSynthesis;
  const frase = new SpeechSynthesisUtterance(testoDevanagari);
  frase.lang = 'hi-IN';
  if (voceHindi) frase.voice = voceHindi;
  frase.rate = lento ? 0.5 : 0.9;
  if (sintesi.speaking || sintesi.pending) {
    // Interrompe la lettura in corso. Su Android, parlare subito dopo un "cancel"
    // a volte non produce suono: si aspetta un istante.
    sintesi.cancel();
    setTimeout(() => sintesi.speak(frase), 80);
  } else {
    sintesi.speak(frase);
  }
}

export function zittisci() {
  if (supportata) window.speechSynthesis.cancel();
}

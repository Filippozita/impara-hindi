// stato.js — progressi salvati sul telefono (localStorage) + ripetizione spaziata (Leitner).
//
// Forma dei dati salvati:
// {
//   versione: 1,
//   voci:    { [idVoce]: { scatola: 0-5, prossimo: "AAAA-MM-GG"|null, debole: bool, segnata: bool } },
//   lezioni: { [idLezione]: { completata: true, data: "AAAA-MM-GG" } },
//   giorni:  { ["AAAA-MM-GG"]: { secondi, sessioni, risposte } },
//   impostazioni: { tema: "auto"|"chiaro"|"scuro" }
// }

const CHIAVE = 'hindi-progressi-v1';

// Giorni di attesa prima del prossimo ripasso, per scatola (indice = numero scatola).
// Scatola 1 = da rivedere subito (oggi), scatola 5 = ogni due settimane.
export const INTERVALLI = [0, 0, 1, 3, 7, 14];

// Una voce conta come "imparata" quando arriva almeno a questa scatola.
export const SCATOLA_IMPARATA = 3;

function statoVuoto() {
  return { versione: 1, voci: {}, lezioni: {}, giorni: {}, impostazioni: { tema: 'auto' } };
}

let stato = statoVuoto();
let salvataggioFunziona = true;

/** Completa un oggetto letto (da disco o da un file importato) con i campi mancanti. */
function ripara(o) {
  const base = statoVuoto();
  if (!o || typeof o !== 'object') return base;
  return {
    versione: 1,
    voci: o.voci && typeof o.voci === 'object' ? o.voci : {},
    lezioni: o.lezioni && typeof o.lezioni === 'object' ? o.lezioni : {},
    giorni: o.giorni && typeof o.giorni === 'object' ? o.giorni : {},
    impostazioni: { ...base.impostazioni, ...(o.impostazioni || {}) },
  };
}

export function carica() {
  try {
    const testo = localStorage.getItem(CHIAVE);
    if (testo) stato = ripara(JSON.parse(testo));
  } catch (e) {
    // localStorage bloccato o dati corrotti: si continua in memoria.
    salvataggioFunziona = false;
  }
  return stato;
}

export function salva() {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(stato));
    salvataggioFunziona = true;
  } catch (e) {
    salvataggioFunziona = false;
  }
  // Avvisa l'app che i progressi sono cambiati (la striscia in alto si aggiorna da sola).
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('progressi-cambiati'));
  return salvataggioFunziona;
}

export const salvataggioOk = () => salvataggioFunziona;
export const leggi = () => stato;

// ---------- Date ----------

/** Data locale nel formato AAAA-MM-GG (ordinabile come testo). */
export function dataLocale(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const oggi = () => dataLocale();

export function sommaGiorni(data, n) {
  const [a, m, g] = data.split('-').map(Number);
  return dataLocale(new Date(a, m - 1, g + n));
}

// ---------- Voci e Leitner ----------

/** Stato di una voce (lo crea se non esiste ancora). */
export function statoVoce(id) {
  if (!stato.voci[id]) stato.voci[id] = { scatola: 0, prossimo: null, debole: false, segnata: false };
  return stato.voci[id];
}

/** Come statoVoce ma senza creare nulla: utile per le sole letture. */
export function leggiVoce(id) {
  return stato.voci[id] || { scatola: 0, prossimo: null, debole: false, segnata: false };
}

/**
 * Registra una risposta e sposta la voce tra le scatole.
 *  - "bene":    sale di una scatola (una voce nuova parte dalla 2)
 *  - "incerto": scende di una scatola e finisce tra quelle da ripassare
 *  - "male":    torna alla scatola 1 e finisce tra quelle da ripassare
 */
export function registraRisposta(id, esito) {
  const v = statoVoce(id);
  if (esito === 'bene') {
    v.scatola = v.scatola === 0 ? 2 : Math.min(5, v.scatola + 1);
    v.debole = false;
  } else if (esito === 'incerto') {
    v.scatola = Math.max(1, v.scatola - 1);
    v.debole = true;
  } else {
    v.scatola = 1;
    v.debole = true;
  }
  v.prossimo = sommaGiorni(oggi(), INTERVALLI[v.scatola]);
  giornoDiOggi().risposte += 1;
  salva();
  return v;
}

/** Segna / toglie a mano una voce dalla lista "Da ripassare". */
export function cambiaSegnata(id) {
  const v = statoVoce(id);
  v.segnata = !v.segnata;
  salva();
  return v.segnata;
}

/** Toglie una voce dalla lista "Da ripassare" (sia il segno a mano sia quello automatico). */
export function togliDaRipassare(id) {
  const v = statoVoce(id);
  v.segnata = false;
  v.debole = false;
  salva();
}

export const inListaRipasso = (id) => {
  const v = leggiVoce(id);
  return v.debole || v.segnata;
};

export const daRipassareOggi = (id) => {
  const v = leggiVoce(id);
  return v.scatola >= 1 && v.prossimo !== null && v.prossimo <= oggi();
};

// ---------- Lezioni ----------

export function completaLezione(id) {
  stato.lezioni[id] = { completata: true, data: oggi() };
  salva();
}

export const lezioneCompletata = (id) => Boolean(stato.lezioni[id] && stato.lezioni[id].completata);

// ---------- Statistiche giornaliere ----------

function giornoDiOggi() {
  const d = oggi();
  if (!stato.giorni[d]) stato.giorni[d] = { secondi: 0, sessioni: 0, risposte: 0 };
  return stato.giorni[d];
}

export function registraSessione() {
  giornoDiOggi().sessioni += 1;
  salva();
}

export function aggiungiSecondi(n) {
  giornoDiOggi().secondi += n;
}

export function statisticheOggi() {
  const g = stato.giorni[oggi()] || { secondi: 0, sessioni: 0, risposte: 0 };
  return { minuti: Math.round(g.secondi / 60), sessioni: g.sessioni, risposte: g.risposte };
}

/** Giorni di fila con almeno una risposta. Oggi non ancora fatto non interrompe la serie. */
export function giorniDiFila() {
  const attivo = (d) => Boolean(stato.giorni[d] && (stato.giorni[d].risposte > 0 || stato.giorni[d].sessioni > 0));
  let giorno = oggi();
  if (!attivo(giorno)) giorno = sommaGiorni(giorno, -1);
  let conta = 0;
  while (attivo(giorno)) {
    conta += 1;
    giorno = sommaGiorni(giorno, -1);
  }
  return conta;
}

// ---------- Impostazioni ----------

export function impostaTema(tema) {
  stato.impostazioni.tema = tema;
  salva();
}

// ---------- Backup ----------

export function esporta() {
  return JSON.stringify({ app: 'impara-hindi', esportato: new Date().toISOString(), ...stato }, null, 2);
}

/** Sostituisce i progressi con quelli di un backup. Lancia un errore se il file non è valido. */
export function importa(testo) {
  let dati;
  try {
    dati = JSON.parse(testo);
  } catch (e) {
    throw new Error('Il file non è un JSON valido.');
  }
  if (!dati || typeof dati !== 'object' || typeof dati.voci !== 'object' || dati.voci === null) {
    throw new Error('Il file non sembra un backup di questa app.');
  }
  stato = ripara(dati);
  salva();
}

export function azzera() {
  const tema = stato.impostazioni.tema;
  stato = statoVuoto();
  stato.impostazioni.tema = tema;
  salva();
}

// voce.js — esercizio di pronuncia: riconoscimento vocale (Web Speech API, hi-IN),
// confronto con il testo atteso e traslitterazione di ciò che il telefono ha capito.
// Il riconoscimento restituisce devanagari: qui viene confrontato e poi convertito in
// lettere latine, così a schermo non compare mai.

const Riconoscimento =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const riconoscimentoDisponibile = () => Boolean(Riconoscimento);

let inCorso = null;

/**
 * Ascolta una frase dal microfono.
 * Risolve con l'elenco delle interpretazioni (la più probabile per prima).
 * Rifiuta con un Error il cui `codice` è: "permesso", "rete", "silenzio", "annullato" o "altro".
 */
export function ascolta() {
  return new Promise((risolvi, rifiuta) => {
    if (!Riconoscimento) {
      rifiuta(Object.assign(new Error('non disponibile'), { codice: 'permesso' }));
      return;
    }
    const r = new Riconoscimento();
    inCorso = r;
    r.lang = 'hi-IN';
    r.interimResults = false;
    r.maxAlternatives = 5;
    let finito = false;
    const chiudi = (funzione, valore) => {
      if (finito) return;
      finito = true;
      inCorso = null;
      funzione(valore);
    };
    r.onresult = (evento) => {
      const alternative = [];
      for (const risultato of evento.results) {
        for (const alt of risultato) alternative.push(alt.transcript);
      }
      chiudi(risolvi, alternative);
    };
    r.onerror = (evento) => {
      const mappa = {
        'not-allowed': 'permesso',
        'service-not-allowed': 'permesso',
        'audio-capture': 'permesso',
        'language-not-supported': 'permesso',
        network: 'rete',
        'no-speech': 'silenzio',
        aborted: 'annullato',
      };
      chiudi(rifiuta, Object.assign(new Error(evento.error), { codice: mappa[evento.error] || 'altro' }));
    };
    // Se finisce senza risultato né errore, non ha sentito niente.
    r.onend = () => chiudi(rifiuta, Object.assign(new Error('silenzio'), { codice: 'silenzio' }));
    try {
      r.start();
    } catch (e) {
      chiudi(rifiuta, Object.assign(new Error(String(e)), { codice: 'altro' }));
    }
  });
}

export function fermaAscolto() {
  if (inCorso) {
    try {
      inCorso.abort();
    } catch (e) {
      /* già fermo */
    }
  }
}

// ---------- Confronto ----------

/**
 * Riduce un testo a una forma confrontabile: toglie punteggiatura e segni che il
 * riconoscimento mette o omette a caso, e uniforma le grafie equivalenti.
 */
export function normalizza(testo) {
  return String(testo)
    .normalize('NFD') // separa il puntino (nukta) dalla lettera
    .replace(/़/g, '') // nukta: ज़ → ज
    .normalize('NFC')
    .toLowerCase()
    .replace(/[​-‍﻿]/g, '') // caratteri invisibili
    .replace(/[?!.,;:।॥'"“”()\-–]/g, ' ')
    .replace(/ँ/g, 'ं') // i due segni di nasale valgono uguale
    .replace(/[नमङञण]्(?=[क-ह])/g, 'ं') // हिन्दी = हिंदी
    .replace(/िये/g, 'िए') // कीजिये = कीजिए
    .replace(/यी/g, 'ई') // गयी = गई
    .replace(/(^|\s)यह(?=\s|$)/g, '$1ये') // "yah" si pronuncia "ye"
    .replace(/(^|\s)वह(?=\s|$)/g, '$1वो') // "vah" si pronuncia "vo"
    .replace(/\s+/g, ' ')
    .trim();
}

/** Distanza di Levenshtein: quante modifiche servono per passare da `a` a `b`. */
export function levenshtein(a, b) {
  const x = [...a];
  const y = [...b];
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let riga = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const nuova = [i];
    for (let j = 1; j <= y.length; j++) {
      const costo = x[i - 1] === y[j - 1] ? 0 : 1;
      nuova[j] = Math.min(riga[j] + 1, nuova[j - 1] + 1, riga[j - 1] + costo);
    }
    riga = nuova;
  }
  return riga[y.length];
}

/** Somiglianza tra 0 (diversi) e 1 (uguali). */
export function somiglianza(a, b) {
  const lunghezza = Math.max([...a].length, [...b].length);
  if (lunghezza === 0) return 1;
  return 1 - levenshtein(a, b) / lunghezza;
}

export const SOGLIA_OTTIMO = 0.85;
export const SOGLIA_QUASI = 0.6;

/**
 * Confronta le interpretazioni del riconoscimento con la voce attesa.
 * Restituisce { voto: "ottimo"|"quasi"|"riprova", punteggio: 0–1, capito: testo migliore }.
 */
export function valuta(alternative, voce) {
  // Testi accettati: il devanagari della voce più le eventuali "alternative" (es. "21" per i numeri).
  const attesi = [voce.devanagari, ...(voce.alternative || [])].map(normalizza).filter(Boolean);
  let migliore = { punteggio: -1, capito: alternative[0] || '' };
  for (const alt of alternative) {
    const sentito = normalizza(alt);
    for (const atteso of attesi) {
      const punteggio = Math.max(
        somiglianza(sentito, atteso),
        somiglianza(sentito.replace(/ /g, ''), atteso.replace(/ /g, '')), // spazi messi diversamente
      );
      if (punteggio > migliore.punteggio) migliore = { punteggio, capito: alt };
    }
  }
  const p = Math.max(0, migliore.punteggio);
  const voto = p >= SOGLIA_OTTIMO ? 'ottimo' : p >= SOGLIA_QUASI ? 'quasi' : 'riprova';
  return { voto, punteggio: p, capito: migliore.capito };
}

// ---------- Traslitterazione devanagari → lettere latine ----------

const CONSONANTI = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n',
  च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n',
  त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm',
  य: 'y', र: 'r', ल: 'l', व: 'v',
  श: 'sh', ष: 'sh', स: 's', ह: 'h',
};
// Lettere con il puntino sotto (suoni di origine persiana/inglese).
const CON_PUNTINO = { ज: 'z', फ: 'f', क: 'k', ख: 'kh', ग: 'g', ड: 'd', ढ: 'dh' };
const VOCALI = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ii', उ: 'u', ऊ: 'uu', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au', ऑ: 'o', ऍ: 'e' };
const SEGNI_VOCALE = { 'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o', 'ॅ': 'e' };
const CIFRE = '०१२३४५६७८९';

/** Traslittera una sola parola, togliendo la "a" muta dove l'hindi non la pronuncia. */
function traslitteraParola(parola) {
  const lettere = [...parola.normalize('NFD')];
  // Ogni sillaba: c = consonante, v = vocale ('' se nessuna), muta = la vocale è la "a" implicita.
  const sillabe = [];
  for (let i = 0; i < lettere.length; i++) {
    const l = lettere[i];
    if (CONSONANTI[l]) {
      let c = CONSONANTI[l];
      if (lettere[i + 1] === '़') {
        c = CON_PUNTINO[l] || c;
        i++;
      }
      const dopo = lettere[i + 1];
      if (dopo === '्') {
        sillabe.push({ c, v: '', muta: false });
        i++;
      } else if (SEGNI_VOCALE[dopo]) {
        sillabe.push({ c, v: SEGNI_VOCALE[dopo], muta: false });
        i++;
      } else {
        sillabe.push({ c, v: 'a', muta: true });
      }
    } else if (VOCALI[l]) {
      // "-ie" si sente e si scrive "-iye" (boliye, chaahiye).
      const dopoI = l === 'ए' && sillabe.length > 0 && /i$/.test(sillabe[sillabe.length - 1].v);
      sillabe.push({ c: dopoI ? 'y' : '', v: VOCALI[l], muta: false });
    } else if (l === 'ं' || l === 'ँ') {
      // Nasale: si scrive "n" dopo la vocale e la rende non eliminabile.
      const ultima = sillabe[sillabe.length - 1];
      if (ultima) {
        ultima.v += 'n';
        ultima.muta = false;
      }
    } else if (l === 'ः') {
      const ultima = sillabe[sillabe.length - 1];
      if (ultima) ultima.v += 'h';
    } else if (CIFRE.includes(l)) {
      sillabe.push({ c: String(CIFRE.indexOf(l)), v: '', muta: false });
    } else if (/[a-z0-9]/i.test(l)) {
      sillabe.push({ c: l, v: '', muta: false });
    }
  }
  // La "a" implicita cade in fine di parola…
  const ultima = sillabe[sillabe.length - 1];
  if (ultima && ultima.muta && sillabe.length > 1) ultima.v = '';
  // …e in mezzo, tra una sillaba con vocale e una sillaba con vocale (es. "samajhaa" → "samjhaa").
  for (let i = sillabe.length - 2; i >= 1; i--) {
    const s = sillabe[i];
    if (s.muta && s.v === 'a' && sillabe[i - 1].v !== '' && sillabe[i + 1].c !== '' && sillabe[i + 1].v !== '') {
      s.v = '';
    }
  }
  return sillabe.map((s) => s.c + s.v).join('');
}

let dizionario = new Map();

/**
 * Prepara un dizionario parola-per-parola a partire dai contenuti, così le parole già
 * presenti nell'app vengono mostrate esattamente con la traslitterazione delle lezioni.
 */
export function preparaDizionario(voci) {
  dizionario = new Map();
  const pulisci = (t) => t.replace(/[?!.,;:।]/g, ' ').trim().split(/\s+/);
  for (const voce of voci) {
    const hindi = pulisci(voce.devanagari);
    const latino = pulisci(voce.translit);
    if (hindi.length !== latino.length) continue;
    hindi.forEach((parola, i) => {
      const chiave = normalizza(parola);
      if (chiave && !dizionario.has(chiave)) dizionario.set(chiave, latino[i].toLowerCase());
    });
  }
}

/** Converte in lettere latine ciò che il riconoscimento ha capito. */
export function traslittera(testo) {
  return String(testo)
    .replace(/[?!.,;:।॥]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((parola) => dizionario.get(normalizza(parola)) || traslitteraParola(parola))
    .join(' ');
}

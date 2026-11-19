// lezione.js — lo svolgimento di una mini-lezione (Scopri → Abbina → Quiz → Pronuncia → Fine)
// e delle sessioni di ripasso (Abbina → Quiz). Tutte usano lo stesso "telaio" a tutto schermo.

import * as stato from './stato.js';
import * as dati from './dati.js';
import { parla, zittisci, audioUtilizzabile } from './audio.js';
import { riconoscimentoDisponibile, ascolta, fermaAscolto, valuta, traslittera } from './voce.js';
import { h, metti, icona, vai, pulsantiAudio, segnalibro, barra, mescola, vibra } from './ui.js';

/** Quante voci al massimo in una sessione di ripasso (le sessioni devono restare brevi). */
const MAX_RIPASSO = 8;

/** Quante coppie si vedono insieme nell'esercizio "Abbina". */
const COPPIE_VISIBILI = 4;

/** Quante voci già viste nel capitolo rientrano nell'Abbina di una lezione nuova. */
const VOCI_DI_RIPASSO = 3;

/** Voto dopo un errore in più: scende di un gradino. */
const PEGGIORA = { bene: 'incerto', incerto: 'male', male: 'male' };

/** Dal numero di errori su una voce al voto per la ripetizione spaziata. */
const votoDaErrori = (errori) => (errori === 0 ? 'bene' : errori === 1 ? 'incerto' : 'male');

// ---------- Pezzi condivisi ----------

/** Struttura a tutto schermo: intestazione con chiusura e avanzamento, corpo, pulsanti in basso. */
function creaTelaio(radice, { domandaUscita, fasi }) {
  const zonaBarra = h('div', { class: 'es-barra' });
  const fase = h('p', { class: 'es-fase' });
  const corpo = h('div', { class: 'es-corpo' });
  const azioni = h('div', { class: 'es-azioni' });
  const chiudi = h(
    'button',
    {
      class: 'btn-icona',
      type: 'button',
      'aria-label': 'Chiudi',
      onclick: () => {
        const domanda = domandaUscita();
        if (!domanda || window.confirm(domanda)) vai('');
      },
    },
    icona('chiudi'),
  );
  metti(radice, h('div', { class: 'esercizio' }, h('div', { class: 'es-testa' }, chiudi, zonaBarra), fase, corpo, azioni));
  return {
    corpo,
    azioni,
    /** Aggiorna titolo della fase e avanzamento (progresso tra 0 e 1). `inAlto` = torna in cima. */
    imposta(testoFase, progresso, inAlto = true) {
      fase.textContent = testoFase;
      // Una tacca per fase: si vede a colpo d'occhio a che punto è la sessione.
      const attuale = Math.min(fasi.length, Math.floor(progresso * fasi.length + 1e-9));
      metti(
        zonaBarra,
        h(
          'ol',
          { class: 'fasi', 'aria-label': 'Fasi' },
          ...fasi.map((nome, k) => {
            const quota = k < attuale ? 1 : k > attuale ? 0 : progresso * fasi.length - attuale;
            return h('li', { class: k === attuale ? 'attuale' : k < attuale ? 'fatta' : '', 'aria-current': k === attuale ? 'step' : null }, h('span', { class: 'fase-barra' }, h('span', { style: `width:${Math.round(quota * 100)}%` })), h('span', { class: 'fase-nome' }, nome));
          }),
        ),
      );
      if (inAlto) window.scrollTo(0, 0);
    },
  };
}

/** La carta completa di una voce: italiano, traslitterazione, parola per parola, nota, audio, segnalibro. */
function cartaVoce(voce) {
  return h(
    'div',
    { class: 'carta' },
    h('p', { class: 'carta-it' }, voce.it),
    h('p', { class: 'carta-hi', lang: 'hi-Latn' }, voce.translit),
    parolaPerParola(voce),
    voce.nota ? h('p', { class: 'carta-nota' }, voce.nota) : null,
    pulsantiAudio(voce),
    segnalibro(voce),
  );
}

/**
 * "Parola per parola": ogni parola della frase con il suo significato, nell'ordine hindi.
 * Serve a capire come è costruita la frase e a comporne di nuove. Toccando una parola la si ascolta.
 */
function parolaPerParola(voce) {
  const pezzi = dati.scomposizione(voce);
  if (!pezzi) return null;
  return h(
    'div',
    { class: 'scomposizione' },
    h('p', { class: 'scomposizione-titolo' }, 'Parola per parola'),
    h(
      'div',
      { class: 'scomposizione-parole' },
      ...pezzi.map((p) =>
        h(
          'button',
          { class: 'parola', type: 'button', 'aria-label': `${p.translit}: ${p.it || 'significato non indicato'}. Tocca per ascoltare`, onclick: () => parla(p.devanagari) },
          h('span', { class: 'parola-hi', lang: 'hi-Latn' }, p.translit),
          h('span', { class: 'parola-it' }, p.it || '—'),
        ),
      ),
    ),
  );
}

/** Riga compatta di una voce, usata negli elenchi (riepilogo, ripasso, dispensa). */
export function rigaVoce(voce, ...extra) {
  return h(
    'li',
    { class: 'riga-voce' },
    h(
      'div',
      { class: 'riga-testi' },
      h('p', { class: 'riga-hi', lang: 'hi-Latn' }, voce.translit),
      h('p', { class: 'riga-it' }, voce.it),
      voce.nota ? h('p', { class: 'riga-nota' }, voce.nota) : null,
    ),
    h('div', { class: 'riga-azioni' }, pulsantiAudio(voce, { compatti: true }), ...extra),
  );
}

// ---------- Abbina ----------

/**
 * Esercizio a due colonne: hindi a sinistra, italiano a destra. Si tocca una parola per colonna;
 * se corrispondono la coppia sparisce e ne entrano di nuove, altrimenti non si associano.
 *  - coda: le voci da abbinare, nell'ordine in cui entrano (una voce può comparire più volte)
 *  - alProgresso(fatte, totale): chiamata a ogni coppia trovata
 *  - alTermine(errori): alla fine, con una Map idVoce → numero di errori
 */
function abbina(telaio, coda, { alProgresso, alTermine }) {
  const attesa = [...coda];
  const totale = coda.length;
  const errori = new Map();
  const sinistra = new Array(COPPIE_VISIBILI).fill(null); // voci mostrate in hindi
  const destra = new Array(COPPIE_VISIBILI).fill(null); // le stesse, mescolate, in italiano
  let sceltaS = -1;
  let sceltaD = -1;
  let esito = null; // { s, d, giusta } mentre la coppia lampeggia
  let fatte = 0;
  let finito = false;

  const inVista = () => sinistra.filter(Boolean);
  // Due voci uguali o con lo stesso testo non stanno mai in vista insieme (sarebbe ambiguo).
  const inConflitto = (v) => inVista().some((x) => x.id === v.id || x.it === v.it || x.translit === v.translit);

  function riempi() {
    const liberiS = sinistra.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    const liberiD = mescola(destra.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0));
    let tentativi = attesa.length;
    while (liberiS.length > 0 && attesa.length > 0 && tentativi-- > 0) {
      const voce = attesa.shift();
      if (inConflitto(voce)) {
        attesa.push(voce); // rientra più tardi
        continue;
      }
      sinistra[liberiS.shift()] = voce;
      destra[liberiD.shift()] = voce;
    }
  }

  function casella(voce, indice, lato) {
    if (!voce) return h('span', { class: 'coppia-vuota' });
    const scelta = lato === 's' ? sceltaS === indice : sceltaD === indice;
    const inEsito = esito && (lato === 's' ? esito.s === indice : esito.d === indice);
    const classi = ['btn-coppia', lato === 's' ? 'coppia-hi' : 'coppia-it', scelta ? 'scelta' : '', inEsito ? (esito.giusta ? 'giusta' : 'sbagliata') : ''].filter(Boolean).join(' ');
    return h('button', { class: classi, type: 'button', lang: lato === 's' ? 'hi-Latn' : null, 'aria-pressed': String(scelta), onclick: () => tocca(indice, lato) }, lato === 's' ? voce.translit : voce.it);
  }

  function disegna() {
    metti(
      telaio.corpo,
      h('p', { class: 'suggerimento centrato' }, 'Tocca una parola in hindi, poi il suo significato.'),
      h('div', { class: 'abbina' }, h('div', { class: 'abbina-colonna' }, ...sinistra.map((v, i) => casella(v, i, 's'))), h('div', { class: 'abbina-colonna' }, ...destra.map((v, i) => casella(v, i, 'd')))),
    );
    metti(telaio.azioni);
  }

  function tocca(indice, lato) {
    if (esito || finito) return;
    if (lato === 's') {
      sceltaS = indice;
      parla(sinistra[indice].devanagari); // toccando la parola hindi la si sente
    } else {
      sceltaD = indice;
    }
    if (sceltaS < 0 || sceltaD < 0) {
      disegna();
      return;
    }
    const giusta = sinistra[sceltaS].id === destra[sceltaD].id;
    esito = { s: sceltaS, d: sceltaD, giusta };
    if (!giusta) {
      // L'errore conta per entrambe le voci confuse.
      for (const voce of [sinistra[sceltaS], destra[sceltaD]]) errori.set(voce.id, (errori.get(voce.id) || 0) + 1);
    }
    vibra(giusta ? 12 : [30, 60, 30]);
    disegna();
    setTimeout(
      () => {
        if (giusta) {
          sinistra[esito.s] = null;
          destra[esito.d] = null;
          fatte += 1;
          // Le nuove coppie entrano due alla volta, così non sono ovvie.
          const vuote = sinistra.filter((v) => !v).length;
          if (vuote >= 2 || vuote === COPPIE_VISIBILI) riempi();
          if (inVista().length === 0) riempi();
        }
        esito = null;
        sceltaS = -1;
        sceltaD = -1;
        if (alProgresso) alProgresso(fatte, totale);
        if (inVista().length === 0 && attesa.length === 0) {
          finito = true;
          alTermine(errori);
          return;
        }
        disegna();
      },
      giusta ? 320 : 520,
    );
  }

  riempi();
  if (alProgresso) alProgresso(0, totale);
  if (inVista().length === 0) alTermine(errori);
  else disegna();
}

// ---------- Quiz ----------

/**
 * Tre risposte sbagliate plausibili: prima dallo stesso capitolo, poi dalla parte, poi da tutto.
 * Si evitano voci con la stessa traslitterazione o la stessa traduzione (es. khaanaa = cibo/mangiare).
 */
function distrattori(voce) {
  const contesto = dati.contestoVoce(voce.id);
  const scelti = [];
  const giaUsato = (v) => [voce, ...scelti].some((x) => x.id === v.id || x.translit === v.translit || x.it === v.it);
  const delCapitolo = contesto ? contesto.capitolo.voci : [];
  const gruppi = [delCapitolo.filter((v) => v.tipo === voce.tipo), delCapitolo, contesto ? dati.vociDelLivello(contesto.livello).filter((v) => v.tipo === voce.tipo) : [], dati.tutteLeVoci()];
  for (const gruppo of gruppi) {
    for (const candidato of mescola(gruppo)) {
      if (scelti.length >= 3) return scelti;
      if (!giaUsato(candidato)) scelti.push(candidato);
    }
  }
  return scelti;
}

/**
 * Quiz misto, una domanda per voce: italiano→hindi, hindi→italiano, ascolto→significato.
 * Una voce sbagliata torna una volta in fondo.
 *  - alProgresso(fatte, totale, ripetuta): prima di ogni domanda
 *  - allaRisposta(voce, giusta, ripetuta): dopo ogni risposta
 *  - alTermine(): finite le domande
 */
function quiz(telaio, voci, { alProgresso, allaRisposta, alTermine }) {
  // Senza una voce hindi le domande di ascolto non avrebbero senso: si usano solo le altre.
  const tipi = audioUtilizzabile() ? ['it-hi', 'hi-it', 'ascolto'] : ['it-hi', 'hi-it'];
  const coda = mescola(voci).map((voce, i) => ({ voce, tipo: tipi[i % tipi.length], ripetuta: false }));
  const totale = voci.length;
  let fatte = 0;

  function domanda() {
    zittisci();
    if (coda.length === 0) {
      alTermine();
      return;
    }
    const { voce, tipo, ripetuta } = coda.shift();
    alProgresso(fatte, totale, ripetuta);
    const versoHindi = tipo === 'it-hi';
    const opzioni = mescola([voce, ...distrattori(voce)]);
    const intestazione =
      tipo === 'it-hi'
        ? [h('p', { class: 'carta-etichetta' }, 'Come si dice in hindi?'), h('p', { class: 'carta-it' }, voce.it)]
        : tipo === 'hi-it'
          ? [h('p', { class: 'carta-etichetta' }, 'Cosa significa?'), h('p', { class: 'carta-hi', lang: 'hi-Latn' }, voce.translit), pulsantiAudio(voce, { compatti: true })]
          : [h('p', { class: 'carta-etichetta' }, 'Ascolta e scegli il significato'), pulsantiAudio(voce)];
    const riscontro = h('div', { class: 'riscontro', role: 'status' });
    const bottoni = opzioni.map((opzione) =>
      h('button', { class: 'btn btn-opzione', type: 'button', lang: versoHindi ? 'hi-Latn' : null, onclick: () => rispondi(opzione) }, versoHindi ? opzione.translit : opzione.it),
    );
    metti(
      telaio.corpo,
      h('div', { class: 'carta carta-domanda' }, ...intestazione),
      // Quando le risposte sono in hindi, accanto a ognuna c'è un altoparlante:
      // si può ascoltare ogni opzione quante volte si vuole prima di sceglierla.
      versoHindi ? h('p', { class: 'suggerimento centrato' }, 'Tocca l\'altoparlante per ascoltare, la scritta per rispondere.') : null,
      h(
        'div',
        { class: 'opzioni' },
        ...bottoni.map((bottone, k) =>
          versoHindi
            ? h('div', { class: 'opzione-riga' }, bottone, h('button', { class: 'btn btn-audio btn-ascolta-opzione', type: 'button', 'aria-label': 'Ascolta ' + opzioni[k].translit, onclick: () => parla(opzioni[k].devanagari) }, icona('audio')))
            : bottone,
        ),
      ),
    );
    metti(telaio.azioni);
    if (tipo === 'ascolto') parla(voce.devanagari);

    function rispondi(scelta) {
      const giusta = scelta.id === voce.id;
      bottoni.forEach((b, k) => {
        b.disabled = true;
        if (opzioni[k].id === voce.id) b.classList.add('giusta');
        else if (opzioni[k].id === scelta.id) b.classList.add('sbagliata');
      });
      // Una voce sbagliata torna una volta in fondo alla coda.
      if (!giusta && !ripetuta) coda.push({ voce, tipo, ripetuta: true });
      if (!ripetuta) fatte += 1;
      allaRisposta(voce, giusta, ripetuta);
      vibra(giusta ? 12 : [30, 60, 30]);
      riscontro.className = 'riscontro ' + (giusta ? 'riscontro-ok' : 'riscontro-no');
      metti(riscontro, h('p', { class: 'riscontro-titolo' }, giusta ? 'Giusto' : 'Era questa'), h('p', {}, h('strong', { lang: 'hi-Latn' }, voce.translit), ' = ', voce.it));
      parla(voce.devanagari);
      // Esito e "Avanti" insieme in basso, a portata di pollice.
      metti(telaio.azioni, riscontro, h('button', { class: 'btn btn-primario', type: 'button', onclick: domanda }, 'Avanti'));
      // La risposta giusta resta visibile sopra il riquadro dell'esito.
      const bottoneGiusto = bottoni[opzioni.findIndex((o) => o.id === voce.id)];
      requestAnimationFrame(() => bottoneGiusto.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    }
  }
  domanda();
}

// ---------- Mini-lezione ----------

export function avviaLezione(radice, { lezione, livello }) {
  const voci = lezione.voci;
  const n = voci.length;
  const idCapitolo = lezione.origine || lezione.id;
  const capitolo = dati.trovaCapitolo(idCapitolo);
  let terminata = false;
  // Com'era il livello successivo prima di cominciare: serve per annunciare lo sblocco alla fine.
  const indiceLivello = dati.tuttiILivelli().indexOf(livello);
  const successivoEraAperto = dati.livelloSbloccato(indiceLivello + 1);
  // La pronuncia si fa solo se è attiva nelle impostazioni e il telefono ha il riconoscimento vocale.
  const conPronuncia = stato.leggi().impostazioni.pronuncia !== false && riconoscimentoDisponibile();
  const fasi = conPronuncia ? ['Scopri', 'Abbina', 'Quiz', 'Pronuncia'] : ['Scopri', 'Abbina', 'Quiz'];
  const telaio = creaTelaio(radice, {
    fasi,
    domandaUscita: () => (terminata ? '' : 'Uscire dalla lezione? Le risposte date finora restano salvate, ma la lezione non risulterà completata.'),
  });

  // Esito per voce: voto preso nell'Abbina + eventuale errore nel quiz.
  const esiti = new Map(voci.map((v) => [v.id, { voto: 'bene', quizSbagliato: false }]));
  let notaPronuncia = ''; // perché la pronuncia è stata saltata, se lo è stata
  const pronuncia = { provate: 0, ottime: 0 };

  // L'avanzamento copre tutte le fasi, ciascuna lunga n passi.
  const progresso = (fase, passo) => (fase * n + passo) / (n * fasi.length);

  // --- 1. Scopri ---
  function scopri(i) {
    if (i === -1) {
      // Spiegazione introduttiva (facoltativa nei contenuti).
      telaio.imposta('Prima di cominciare', 0);
      metti(telaio.corpo, h('div', { class: 'carta carta-testo' }, h('p', { class: 'carta-etichetta' }, lezione.titoloBase || lezione.titolo), ...lezione.spiegazione.split('\n').filter(Boolean).map((riga) => h('p', {}, riga))));
      metti(telaio.azioni, h('button', { class: 'btn btn-primario', type: 'button', onclick: () => scopri(0) }, 'Ho capito, avanti'));
      return;
    }
    const voce = voci[i];
    telaio.imposta(`Scopri · ${i + 1} di ${n}`, progresso(0, i));
    metti(telaio.corpo, cartaVoce(voce));
    parla(voce.devanagari);
    metti(
      telaio.azioni,
      h(
        'div',
        { class: 'coppia' },
        i > 0 ? h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => scopri(i - 1) }, 'Indietro') : null,
        h('button', { class: 'btn btn-primario', type: 'button', onclick: () => (i + 1 < n ? scopri(i + 1) : avviaAbbina()) }, 'Avanti'),
      ),
    );
  }

  // --- 2. Abbina ---
  function avviaAbbina() {
    zittisci();
    // Le voci nuove compaiono due volte; in mezzo ce ne sono alcune già viste nel capitolo.
    const precedenti = [];
    for (const parte of capitolo ? capitolo.parti : []) {
      if (parte.id === lezione.id) break;
      precedenti.push(...parte.voci);
    }
    const diRipasso = mescola(precedenti).slice(0, VOCI_DI_RIPASSO);
    const coda = [...mescola([...voci, ...diRipasso]), ...mescola(voci)];
    abbina(telaio, coda, {
      alProgresso: (fatte, totale) => telaio.imposta(`Abbina · ${fatte} di ${totale}`, progresso(1, (fatte / totale) * n), false),
      alTermine: (errori) => {
        // Salvate subito: la striscia dei progressi in alto si muove a ogni fase.
        for (const voce of voci) {
          const voto = votoDaErrori(errori.get(voce.id) || 0);
          esiti.get(voce.id).voto = voto;
          stato.registraRisposta(voce.id, voto);
        }
        // Una voce vecchia sbagliata torna tra quelle da ripassare.
        for (const voce of diRipasso) if (errori.get(voce.id)) stato.registraRisposta(voce.id, 'incerto');
        avviaQuiz();
      },
    });
  }

  // --- 3. Quiz ---
  function avviaQuiz() {
    quiz(telaio, voci, {
      alProgresso: (fatte, totale, ripetuta) => telaio.imposta(ripetuta ? 'Quiz · riproviamo' : `Quiz · ${fatte + 1} di ${totale}`, progresso(2, Math.min(fatte, n - 1))),
      allaRisposta: (voce, giusta) => {
        const e = esiti.get(voce.id);
        // Un errore nel quiz abbassa di un gradino il voto preso nell'Abbina (una volta sola).
        if (!giusta && !e.quizSbagliato) {
          e.quizSbagliato = true;
          stato.registraRisposta(voce.id, PEGGIORA[e.voto]);
        }
      },
      alTermine: () => (conPronuncia ? passoPronuncia(0) : fine()),
    });
  }

  // --- 4. Pronuncia ---
  function passoPronuncia(i) {
    zittisci();
    fermaAscolto();
    if (i >= n) {
      fine();
      return;
    }
    const voce = voci[i];
    telaio.imposta(`Pronuncia · ${i + 1} di ${n}`, progresso(3, i));
    const esito = h('div', { class: 'esito-voce', role: 'status' }, h('p', { class: 'suggerimento' }, 'Ascolta, poi tieni il telefono vicino e ripeti.'));
    const etichettaMic = h('span', {}, 'Tocca e parla');
    const mic = h('button', { class: 'btn-mic', type: 'button', onclick: registra }, icona('mic'), etichettaMic);
    metti(
      telaio.corpo,
      h('div', { class: 'carta' }, h('p', { class: 'carta-etichetta' }, 'Ascolta e ripeti'), h('p', { class: 'carta-hi', lang: 'hi-Latn' }, voce.translit), h('p', { class: 'carta-it carta-it-piccolo' }, voce.it), pulsantiAudio(voce)),
      mic,
      esito,
    );
    const avanti = h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => passoPronuncia(i + 1) }, 'Salta');
    metti(telaio.azioni, avanti, h('button', { class: 'btn-testo', type: 'button', onclick: () => fine() }, 'Salta tutta la pronuncia'));
    parla(voce.devanagari);

    async function registra() {
      zittisci();
      mic.disabled = true;
      mic.classList.add('attivo');
      etichettaMic.textContent = 'Ti ascolto…';
      try {
        const alternative = await ascolta();
        const risultato = valuta(alternative, voce);
        pronuncia.provate += 1;
        if (risultato.voto === 'ottimo') pronuncia.ottime += 1;
        const titoli = { ottimo: 'Ottimo!', quasi: 'Quasi', riprova: 'Riprova' };
        metti(esito, h('p', { class: 'voto voto-' + risultato.voto }, titoli[risultato.voto]), h('p', { class: 'capito' }, 'Ho capito: ', h('strong', { lang: 'hi-Latn' }, traslittera(risultato.capito) || '…')));
        avanti.textContent = 'Avanti';
        avanti.className = 'btn ' + (risultato.voto === 'riprova' ? 'btn-secondario' : 'btn-primario');
      } catch (errore) {
        if (errore.codice === 'permesso' || errore.codice === 'rete') {
          // Microfono negato o servizio non raggiungibile: non si blocca la lezione.
          // Senza permesso l'esercizio si spegne da solo: inutile riproporlo a ogni lezione.
          if (errore.codice === 'permesso') stato.impostaPronuncia(false);
          notaPronuncia =
            errore.codice === 'permesso'
              ? 'L\'esercizio di pronuncia è stato saltato: il microfono non è disponibile o manca il permesso. L\'ho disattivato: puoi riaccenderlo in Altro.'
              : 'L\'esercizio di pronuncia è stato saltato: il riconoscimento vocale ha bisogno di internet.';
          fine();
          return;
        }
        if (errore.codice !== 'annullato') {
          metti(esito, h('p', { class: 'suggerimento' }, errore.codice === 'silenzio' ? 'Non ho sentito niente. Riprova parlando più vicino al telefono.' : 'Qualcosa non ha funzionato. Riprova oppure salta.'));
        }
      } finally {
        mic.disabled = false;
        mic.classList.remove('attivo');
        etichettaMic.textContent = 'Tocca e parla';
      }
    }
  }

  // --- 5. Fine ---
  function fine() {
    if (terminata) return;
    terminata = true;
    zittisci();
    fermaAscolto();

    // Le risposte sono già state salvate una per una: qui si fa solo il riepilogo.
    let sapute = 0;
    const deboli = [];
    for (const voce of voci) {
      const e = esiti.get(voce.id);
      const voto = e.quizSbagliato ? PEGGIORA[e.voto] : e.voto;
      if (voto === 'bene') sapute += 1;
      else deboli.push(voce);
    }
    stato.completaLezione(lezione.id);
    stato.registraSessione();

    const livelloNuovo = dati.tuttiILivelli()[indiceLivello + 1];
    const appenaSbloccato = livelloNuovo && !successivoEraAperto && dati.livelloSbloccato(indiceLivello + 1);
    const prossima = dati.lezioneSuccessiva(lezione.id);
    const capitoloFinito = Boolean(capitolo && capitolo.parti.every(dati.lezioneFatta));

    telaio.imposta('Lezione completata', 1);
    metti(
      telaio.corpo,
      h(
        'div',
        { class: 'carta carta-fine' },
        h('p', { class: 'carta-etichetta' }, lezione.titolo),
        h('p', { class: 'fine-numero' }, `${sapute} su ${n}`),
        h('p', {}, sapute === n ? 'Tutte giuste al primo colpo. Shaabaash! (Bravo!)' : 'voci giuste al primo colpo'),
        pronuncia.provate > 0 ? h('p', { class: 'suggerimento' }, `Pronuncia: ${pronuncia.ottime} "ottimo" su ${pronuncia.provate} tentativi.`) : null,
      ),
      capitoloFinito ? h('div', { class: 'banner banner-ok' }, h('strong', {}, 'Capitolo completato: '), capitolo.capitolo.titolo, '. Fai il ripasso del capitolo per fissarlo.') : null,
      appenaSbloccato ? h('div', { class: 'banner banner-ok' }, h('strong', {}, 'Nuova parte sbloccata: '), livelloNuovo.titolo) : null,
      notaPronuncia ? h('div', { class: 'banner' }, notaPronuncia) : null,
      deboli.length > 0 ? h('section', {}, h('h2', { class: 'titolo-sezione' }, 'Da ripassare'), h('p', { class: 'suggerimento' }, 'Le ritrovi nel ripasso di oggi.'), h('ul', { class: 'elenco-voci' }, ...deboli.map((v) => rigaVoce(v)))) : null,
    );
    metti(
      telaio.azioni,
      capitoloFinito
        ? h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('ripasso-capitolo/' + idCapitolo) }, 'Ripasso del capitolo')
        : prossima
          ? h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('lezione/' + prossima.lezione.id) }, 'Lezione successiva')
          : null,
      h(
        'div',
        { class: 'coppia' },
        h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => vai('dispensa/' + idCapitolo) }, 'Dispensa'),
        capitoloFinito && prossima
          ? h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => vai('lezione/' + prossima.lezione.id) }, 'Avanti')
          : h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => vai('') }, 'Home'),
      ),
    );
  }

  scopri(lezione.spiegazione ? -1 : 0);

  // Funzione di pulizia: chiamata dal router quando si lascia la schermata.
  return () => {
    zittisci();
    fermaAscolto();
  };
}

// ---------- Ripasso ----------

/**
 * Sessione di ripasso: prima si abbinano le voci, poi una domanda di quiz per ciascuna.
 * Il voto di ogni voce (errori nell'Abbina + errore nel quiz) viene salvato dopo la sua domanda.
 */
export function avviaRipasso(radice, vociDaFare, { titolo, ritorno = '' }) {
  const voci = mescola(vociDaFare).slice(0, MAX_RIPASSO);
  const n = voci.length;
  const telaio = creaTelaio(radice, { fasi: ['Abbina', 'Quiz'], domandaUscita: () => '' });
  const erroriAbbina = new Map();
  const conteggio = { bene: 0, incerto: 0, male: 0 };
  let terminata = false;

  function fine() {
    if (!terminata && n > 0) stato.registraSessione();
    terminata = true;
    const rimaste = vociDaFare.length - n;
    telaio.imposta(titolo, 1);
    metti(
      telaio.corpo,
      h(
        'div',
        { class: 'carta carta-fine' },
        h('p', { class: 'carta-etichetta' }, titolo),
        h('p', { class: 'fine-numero' }, n === 0 ? '0' : `${conteggio.bene} su ${n}`),
        h('p', {}, n === 0 ? 'Niente da ripassare per ora. Torna più tardi o fai una lezione nuova.' : 'voci ricordate senza errori'),
        conteggio.incerto + conteggio.male > 0 ? h('p', { class: 'suggerimento' }, `${conteggio.incerto + conteggio.male} tornano nel ripasso: le rivedrai presto.`) : null,
        rimaste > 0 ? h('p', { class: 'suggerimento' }, `Ne restano altre ${rimaste} per un'altra sessione.`) : null,
      ),
    );
    metti(
      telaio.azioni,
      rimaste > 0 ? h('button', { class: 'btn btn-primario', type: 'button', onclick: () => avviaRipasso(radice, vociDaFare.filter((v) => !voci.includes(v)), { titolo, ritorno }) }, 'Continua il ripasso') : null,
      h('button', { class: 'btn ' + (rimaste > 0 ? 'btn-secondario' : 'btn-primario'), type: 'button', onclick: () => vai(ritorno) }, ritorno === 'livelli' ? 'Torna alle lezioni' : 'Torna alla home'),
    );
  }

  if (n === 0) {
    fine();
    return () => zittisci();
  }

  abbina(telaio, voci, {
    alProgresso: (fatte, totale) => telaio.imposta(`${titolo} · abbina ${fatte} di ${totale}`, (fatte / totale) * 0.5, false),
    alTermine: (errori) => {
      errori.forEach((quanti, id) => erroriAbbina.set(id, quanti));
      quiz(telaio, voci, {
        alProgresso: (fatte, totale, ripetuta) => telaio.imposta(ripetuta ? `${titolo} · riproviamo` : `${titolo} · quiz ${fatte + 1} di ${totale}`, 0.5 + (Math.min(fatte, totale - 1) / totale) * 0.5),
        allaRisposta: (voce, giusta, ripetuta) => {
          if (ripetuta) return; // il voto è già stato dato alla prima domanda
          const voto = votoDaErrori((erroriAbbina.get(voce.id) || 0) + (giusta ? 0 : 1));
          stato.registraRisposta(voce.id, voto);
          conteggio[voto] += 1;
        },
        alTermine: fine,
      });
    },
  });

  return () => zittisci();
}

// lezione.js — lo svolgimento di una lezione (Scopri → Flashcard → Quiz → Pronuncia → Fine)
// e la sessione di ripasso a flashcard. Entrambe usano lo stesso "telaio" a tutto schermo.

import * as stato from './stato.js';
import * as dati from './dati.js';
import { parla, zittisci, audioUtilizzabile } from './audio.js';
import { riconoscimentoDisponibile, ascolta, fermaAscolto, valuta, traslittera } from './voce.js';
import { h, metti, icona, vai, pulsantiAudio, segnalibro, barra, mescola, vibra } from './ui.js';

/** Voto dopo un errore nel quiz: scende di un gradino. */
const PEGGIORA = { bene: 'incerto', incerto: 'male', male: 'male' };

/** Quante voci al massimo in una sessione di ripasso (le sessioni devono restare brevi). */
const MAX_RIPASSO = 20;

// ---------- Pezzi condivisi ----------

/** Struttura a tutto schermo: intestazione con chiusura e barra, corpo, pulsanti in basso. */
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
        if (!domandaUscita() || window.confirm(domandaUscita())) vai('');
      },
    },
    icona('chiudi'),
  );
  metti(radice, h('div', { class: 'esercizio' }, h('div', { class: 'es-testa' }, chiudi, zonaBarra), fase, corpo, azioni));
  return {
    corpo,
    azioni,
    /** Aggiorna titolo della fase e barra (progresso tra 0 e 1). */
    imposta(testoFase, progresso) {
      fase.textContent = testoFase;
      if (fasi) {
        // Una tacca per fase: si vede a colpo d'occhio a che punto è la lezione.
        const attuale = Math.min(fasi.length, Math.floor(progresso * fasi.length + 1e-9));
        metti(
          zonaBarra,
          h(
            'ol',
            { class: 'fasi', 'aria-label': 'Fasi della lezione' },
            ...fasi.map((nome, k) => {
              const quota = k < attuale ? 1 : k > attuale ? 0 : progresso * fasi.length - attuale;
              return h('li', { class: k === attuale ? 'attuale' : k < attuale ? 'fatta' : '', 'aria-current': k === attuale ? 'step' : null }, h('span', { class: 'fase-barra' }, h('span', { style: `width:${Math.round(quota * 100)}%` })), h('span', { class: 'fase-nome' }, nome));
            }),
          ),
        );
      } else {
        metti(zonaBarra, barra(progresso, 'Avanzamento della sessione'));
      }
      corpo.scrollTop = 0;
      window.scrollTo(0, 0);
    },
  };
}

/** La carta completa di una voce: italiano, traslitterazione, nota, audio, segnalibro. */
function cartaVoce(voce, { etichetta } = {}) {
  return h(
    'div',
    { class: 'carta' },
    etichetta ? h('p', { class: 'carta-etichetta' }, etichetta) : null,
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

/** Riga compatta di una voce, usata negli elenchi (riepilogo, "Da ripassare"). */
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

/** Mostra una flashcard: prima il lato italiano (si gira toccandolo), poi la risposta con l'autovalutazione. */
function mostraFlashcard(telaio, voce, alVoto) {
  const voto = (esito, nome, effetto) =>
    h(
      'button',
      {
        class: 'btn btn-' + esito,
        type: 'button',
        onclick: () => {
          vibra(10);
          alVoto(esito);
        },
      },
      h('span', {}, nome),
      h('small', {}, effetto),
    );
  const gira = () => {
    vibra(8);
    const retro = cartaVoce(voce);
    retro.classList.add('carta-girata');
    metti(telaio.corpo, retro);
    parla(voce.devanagari);
    metti(
      telaio.azioni,
      h('p', { class: 'es-domanda' }, 'La sapevi?'),
      h('div', { class: 'voti' }, voto('male', 'Non sapevo', 'torna subito'), voto('incerto', 'Incerto', 'torna oggi'), voto('bene', 'Sapevo', 'va avanti')),
    );
  };
  metti(
    telaio.corpo,
    h(
      'button',
      { class: 'carta carta-domanda carta-tocca', type: 'button', onclick: gira },
      h('span', { class: 'carta-etichetta' }, 'Come si dice in hindi?'),
      h('span', { class: 'carta-it' }, voce.it),
      h('span', { class: 'carta-suggerimento' }, 'Dillo ad alta voce, poi tocca la carta'),
    ),
  );
  metti(telaio.azioni, h('button', { class: 'btn btn-primario', type: 'button', onclick: gira }, 'Mostra la risposta'));
}

// ---------- Lezione ----------

export function avviaLezione(radice, { lezione, livello }) {
  const voci = lezione.voci;
  const n = voci.length;
  let terminata = false;
  // Com'era il livello successivo prima di cominciare: serve per annunciare lo sblocco alla fine.
  const indiceLivello = dati.tuttiILivelli().indexOf(livello);
  const successivoEraAperto = dati.livelloSbloccato(indiceLivello + 1);
  const telaio = creaTelaio(radice, {
    fasi: ['Scopri', 'Flashcard', 'Quiz', 'Pronuncia'],
    domandaUscita: () => (terminata ? '' : 'Uscire dalla lezione? Le risposte date finora restano salvate, ma la lezione non risulterà completata.'),
  });

  // Esito per voce: voto dato nella flashcard + eventuale errore nel quiz.
  const esiti = new Map(voci.map((v) => [v.id, { carta: 'bene', quizSbagliato: false }]));
  let notaPronuncia = ''; // perché la pronuncia è stata saltata, se lo è stata
  const pronuncia = { provate: 0, ottime: 0 };

  // La barra copre le quattro fasi, ciascuna lunga n passi.
  const progresso = (fase, passo) => (fase * n + passo) / (n * 4);

  // --- 1. Scopri ---
  function scopri(i) {
    if (i === -1) {
      // Spiegazione introduttiva della lezione (facoltativa nei contenuti).
      telaio.imposta('Prima di cominciare', 0);
      metti(telaio.corpo, 
        h('div', { class: 'carta carta-testo' }, h('p', { class: 'carta-etichetta' }, lezione.titolo), ...lezione.spiegazione.split('\n').filter(Boolean).map((riga) => h('p', {}, riga))),
      );
      metti(telaio.azioni, h('button', { class: 'btn btn-primario', type: 'button', onclick: () => scopri(0) }, 'Ho capito, avanti'));
      return;
    }
    const voce = voci[i];
    telaio.imposta(`Scopri · ${i + 1} di ${n}`, progresso(0, i));
    metti(telaio.corpo, cartaVoce(voce));
    parla(voce.devanagari);
    metti(telaio.azioni, 
      h(
        'div',
        { class: 'coppia' },
        i > 0 ? h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => scopri(i - 1) }, 'Indietro') : null,
        h('button', { class: 'btn btn-primario', type: 'button', onclick: () => (i + 1 < n ? scopri(i + 1) : flashcard(0, mescola(voci))) }, 'Avanti'),
      ),
    );
  }

  // --- 2. Flashcard ---
  function flashcard(i, ordine) {
    zittisci();
    const voce = ordine[i];
    telaio.imposta(`Flashcard · ${i + 1} di ${n}`, progresso(1, i));
    mostraFlashcard(telaio, voce, (voto) => {
      esiti.get(voce.id).carta = voto;
      // Salvata subito: la striscia dei progressi in alto si muove a ogni risposta.
      stato.registraRisposta(voce.id, voto);
      if (i + 1 < n) flashcard(i + 1, ordine);
      else avviaQuiz();
    });
  }

  // --- 3. Quiz misto ---
  function avviaQuiz() {
    // Senza una voce hindi le domande di ascolto non avrebbero senso: si usano solo le altre.
    const tipi = audioUtilizzabile() ? ['it-hi', 'hi-it', 'ascolto'] : ['it-hi', 'hi-it'];
    const coda = mescola(voci).map((voce, i) => ({ voce, tipo: tipi[i % tipi.length], ripetuta: false }));
    let fatte = 0;

    function domanda() {
      zittisci();
      if (coda.length === 0) {
        avviaPronuncia();
        return;
      }
      const { voce, tipo, ripetuta } = coda.shift();
      telaio.imposta(ripetuta ? 'Quiz · riproviamo' : `Quiz · ${fatte + 1} di ${n}`, progresso(2, Math.min(fatte, n - 1)));
      const versoHindi = tipo === 'it-hi';
      const testo = (v) => (versoHindi ? v.translit : v.it);
      const opzioni = mescola([voce, ...distrattori(voce, lezione, livello)]);

      const intestazione =
        tipo === 'it-hi'
          ? [h('p', { class: 'carta-etichetta' }, 'Come si dice in hindi?'), h('p', { class: 'carta-it' }, voce.it)]
          : tipo === 'hi-it'
            ? [h('p', { class: 'carta-etichetta' }, 'Cosa significa?'), h('p', { class: 'carta-hi', lang: 'hi-Latn' }, voce.translit), pulsantiAudio(voce, { compatti: true })]
            : [h('p', { class: 'carta-etichetta' }, 'Ascolta e scegli il significato'), pulsantiAudio(voce)];
      const riscontro = h('div', { class: 'riscontro', role: 'status' });
      const bottoni = opzioni.map((opzione) =>
        h('button', { class: 'btn btn-opzione', type: 'button', lang: versoHindi ? 'hi-Latn' : null, onclick: () => rispondi(opzione) }, testo(opzione)),
      );
      metti(telaio.corpo, h('div', { class: 'carta carta-domanda' }, ...intestazione), 
        // Quando le risposte sono in hindi, accanto a ognuna c'è un altoparlante:
        // si può ascoltare ogni opzione quante volte si vuole prima di sceglierla.
        versoHindi ? h('p', { class: 'suggerimento centrato' }, 'Tocca l\'altoparlante per ascoltare, la scritta per rispondere.') : null,
        h(
          'div',
          { class: 'opzioni' },
          ...bottoni.map((bottone, k) =>
            versoHindi
              ? h(
                  'div',
                  { class: 'opzione-riga' },
                  bottone,
                  h('button', { class: 'btn btn-audio btn-ascolta-opzione', type: 'button', 'aria-label': 'Ascolta ' + opzioni[k].translit, onclick: () => parla(opzioni[k].devanagari) }, icona('audio')),
                )
              : bottone,
          ),
        ),
        riscontro,
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
        if (!giusta) {
          // Un errore nel quiz abbassa di un gradino il voto dato nella flashcard (una volta sola).
          if (!esiti.get(voce.id).quizSbagliato) stato.registraRisposta(voce.id, PEGGIORA[esiti.get(voce.id).carta]);
          esiti.get(voce.id).quizSbagliato = true;
          // Una voce sbagliata torna una volta in fondo alla coda.
          if (!ripetuta) coda.push({ voce, tipo, ripetuta: true });
        }
        if (!ripetuta) fatte += 1;
        vibra(giusta ? 12 : [30, 60, 30]);
        riscontro.className = 'riscontro ' + (giusta ? 'riscontro-ok' : 'riscontro-no');
        metti(riscontro, h('p', { class: 'riscontro-titolo' }, giusta ? 'Giusto' : 'Era questa'), h('p', {}, h('strong', { lang: 'hi-Latn' }, voce.translit), ' = ', voce.it));
        parla(voce.devanagari);
        // Esito e "Avanti" insieme in basso, a portata di pollice.
        metti(telaio.azioni, riscontro, h('button', { class: 'btn btn-primario', type: 'button', onclick: domanda }, 'Avanti'));
      }
    }
    domanda();
  }

  // --- 4. Pronuncia ---
  function avviaPronuncia() {
    if (!riconoscimentoDisponibile()) {
      notaPronuncia = 'L\'esercizio di pronuncia è stato saltato: questo browser non offre il riconoscimento vocale.';
      fine();
      return;
    }
    passoPronuncia(0);
  }

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
    metti(telaio.corpo, 
      h(
        'div',
        { class: 'carta' },
        h('p', { class: 'carta-etichetta' }, 'Ascolta e ripeti'),
        h('p', { class: 'carta-hi', lang: 'hi-Latn' }, voce.translit),
        h('p', { class: 'carta-it carta-it-piccolo' }, voce.it),
        pulsantiAudio(voce),
      ),
      mic,
      esito,
    );
    const avanti = h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => passoPronuncia(i + 1) }, 'Salta');
    metti(telaio.azioni, 
      avanti,
      h('button', { class: 'btn-testo', type: 'button', onclick: fine }, 'Salta tutta la pronuncia'),
    );
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
        metti(esito, 
          h('p', { class: 'voto voto-' + risultato.voto }, titoli[risultato.voto]),
          h('p', { class: 'capito' }, 'Ho capito: ', h('strong', { lang: 'hi-Latn' }, traslittera(risultato.capito) || '…')),
        );
        avanti.textContent = 'Avanti';
        avanti.className = 'btn ' + (risultato.voto === 'riprova' ? 'btn-secondario' : 'btn-primario');
      } catch (errore) {
        if (errore.codice === 'permesso' || errore.codice === 'rete') {
          // Microfono negato o servizio non raggiungibile: non si blocca la lezione.
          notaPronuncia =
            errore.codice === 'permesso'
              ? 'L\'esercizio di pronuncia è stato saltato: il microfono non è disponibile o manca il permesso.'
              : 'L\'esercizio di pronuncia è stato saltato: il riconoscimento vocale ha bisogno di internet.';
          fine();
          return;
        }
        if (errore.codice !== 'annullato') {
          metti(esito, 
            h('p', { class: 'suggerimento' }, errore.codice === 'silenzio' ? 'Non ho sentito niente. Riprova parlando più vicino al telefono.' : 'Qualcosa non ha funzionato. Riprova oppure salta.'),
          );
        }
      } finally {
        mic.disabled = false;
        mic.classList.remove('attivo');
        etichettaMic.textContent = 'Tocca e parla';
      }
    }
  }

  // --- 5. Fine: si salvano i risultati ---
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
      const voto = e.quizSbagliato ? PEGGIORA[e.carta] : e.carta;
      if (voto === 'bene') sapute += 1;
      else deboli.push(voce);
    }
    stato.completaLezione(lezione.id);
    stato.registraSessione();

    const livelloNuovo = dati.tuttiILivelli()[indiceLivello + 1];
    const appenaSbloccato = livelloNuovo && !successivoEraAperto && dati.livelloSbloccato(indiceLivello + 1);
    const prossima = dati.lezioneSuccessiva(lezione.id);

    telaio.imposta('Lezione completata', 1);
    metti(telaio.corpo, 
      h(
        'div',
        { class: 'carta carta-fine' },
        h('p', { class: 'carta-etichetta' }, lezione.titolo),
        h('p', { class: 'fine-numero' }, `${sapute} su ${n}`),
        h('p', {}, sapute === n ? 'Le sapevi tutte. Shaabaash! (Bravo!)' : 'voci sapute al primo colpo'),
        pronuncia.provate > 0 ? h('p', { class: 'suggerimento' }, `Pronuncia: ${pronuncia.ottime} "ottimo" su ${pronuncia.provate} tentativi.`) : null,
      ),
      appenaSbloccato ? h('div', { class: 'banner banner-ok' }, h('strong', {}, 'Nuovo livello sbloccato: '), livelloNuovo.titolo) : null,
      notaPronuncia ? h('div', { class: 'banner' }, notaPronuncia) : null,
      deboli.length > 0
        ? h('section', {}, h('h2', { class: 'titolo-sezione' }, 'Da ripassare'), h('p', { class: 'suggerimento' }, 'Le ritrovi nel ripasso di oggi e nella pagina "Da ripassare".'), h('ul', { class: 'elenco-voci' }, ...deboli.map((v) => rigaVoce(v))))
        : null,
    );
    metti(telaio.azioni, 
      prossima ? h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('lezione/' + prossima.lezione.id) }, 'Lezione successiva') : null,
      h('button', { class: 'btn ' + (prossima ? 'btn-secondario' : 'btn-primario'), type: 'button', onclick: () => vai('') }, 'Torna alla home'),
    );
  }

  scopri(lezione.spiegazione ? -1 : 0);

  // Funzione di pulizia: chiamata dal router quando si lascia la schermata.
  return () => {
    zittisci();
    fermaAscolto();
  };
}

/**
 * Tre risposte sbagliate plausibili: prima dalla stessa lezione, poi dal livello, poi da tutto.
 * Si evitano voci con la stessa traslitterazione o la stessa traduzione (es. khaanaa = cibo/mangiare).
 */
function distrattori(voce, lezione, livello) {
  const scelti = [];
  const giaUsato = (v) => [voce, ...scelti].some((x) => x.id === v.id || x.translit === v.translit || x.it === v.it);
  const gruppi = [
    lezione.voci.filter((v) => v.tipo === voce.tipo),
    lezione.voci,
    dati.vociDelLivello(livello).filter((v) => v.tipo === voce.tipo),
    dati.tutteLeVoci(),
  ];
  for (const gruppo of gruppi) {
    for (const candidato of mescola(gruppo)) {
      if (scelti.length >= 3) return scelti;
      if (!giaUsato(candidato)) scelti.push(candidato);
    }
  }
  return scelti;
}

// ---------- Ripasso ----------

/** Sessione di ripasso a flashcard: ogni voto aggiorna subito la scatola della voce. */
export function avviaRipasso(radice, vociDaFare, { titolo }) {
  const voci = mescola(vociDaFare).slice(0, MAX_RIPASSO);
  const n = voci.length;
  let terminata = n === 0;
  const telaio = creaTelaio(radice, { domandaUscita: () => '' }); // ogni risposta è già salvata
  const conteggio = { bene: 0, incerto: 0, male: 0 };

  function carta(i) {
    zittisci();
    if (i >= n) {
      fine();
      return;
    }
    telaio.imposta(`${titolo} · ${i + 1} di ${n}`, i / n);
    mostraFlashcard(telaio, voci[i], (voto) => {
      stato.registraRisposta(voci[i].id, voto);
      conteggio[voto] += 1;
      carta(i + 1);
    });
  }

  function fine() {
    if (!terminata) stato.registraSessione();
    terminata = true;
    const rimaste = vociDaFare.length - n;
    telaio.imposta('Ripasso completato', 1);
    metti(telaio.corpo, 
      h(
        'div',
        { class: 'carta carta-fine' },
        h('p', { class: 'carta-etichetta' }, titolo),
        h('p', { class: 'fine-numero' }, `${conteggio.bene} su ${n}`),
        h('p', {}, 'voci sapute'),
        conteggio.incerto + conteggio.male > 0 ? h('p', { class: 'suggerimento' }, `${conteggio.incerto + conteggio.male} tornano nel ripasso: le rivedrai presto.`) : null,
        rimaste > 0 ? h('p', { class: 'suggerimento' }, `Ne restano altre ${rimaste} per un'altra sessione.`) : null,
      ),
    );
    metti(telaio.azioni, h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('') }, 'Torna alla home'));
  }

  if (n === 0) {
    telaio.imposta(titolo, 1);
    metti(telaio.corpo, h('div', { class: 'carta carta-fine' }, h('p', { class: 'fine-numero' }, '0'), h('p', {}, 'Niente da ripassare per ora. Torna più tardi o fai una nuova lezione.')));
    metti(telaio.azioni, h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('') }, 'Torna alla home'));
  } else {
    carta(0);
  }

  return () => zittisci();
}

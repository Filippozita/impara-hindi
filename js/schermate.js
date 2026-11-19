// schermate.js — le pagine "ferme" dell'app: home, livelli, da ripassare, progressi,
// come si legge, altro (tema, audio, backup). Ognuna riceve l'elemento in cui disegnarsi.

import * as stato from './stato.js';
import * as dati from './dati.js';
import { parla, statoVoceHindi } from './audio.js';
import { h, metti, icona, vai, barra, avviso } from './ui.js';
import { rigaVoce } from './lezione.js';

const pct = (x) => Math.round(x * 100) + '%';
const plurale = (n, uno, molti) => `${n} ${n === 1 ? uno : molti}`;

/** Istruzioni per installare la voce hindi su Android (usate in più punti). */
function istruzioniVoce() {
  return h(
    'ol',
    { class: 'passi' },
    h('li', {}, 'Apri le Impostazioni del telefono e cerca "Sintesi vocale" (di solito in Sistema → Lingua e immissione, oppure in Accessibilità).'),
    h('li', {}, 'Come motore preferito scegli "Servizi vocali di Google". Se non c\'è, installalo dal Play Store.'),
    h('li', {}, 'Tocca l\'ingranaggio accanto al motore → "Installa dati vocali" → "Hindi (India)" e scarica la voce.'),
    h('li', {}, 'Chiudi del tutto questa app e riaprila.'),
  );
}

function avvisoVoce() {
  const s = statoVoceHindi();
  if (s === 'mancante') {
    return h('details', { class: 'banner' }, h('summary', {}, 'Manca la voce hindi: l\'audio potrebbe non funzionare. Tocca per le istruzioni.'), istruzioniVoce());
  }
  if (s === 'non-supportato') return h('div', { class: 'banner' }, 'Questo browser non ha la sintesi vocale: l\'audio non è disponibile. Usa Chrome su Android.');
  return null;
}

// ---------- Home ----------

/** Anello dell'obiettivo del giorno: si riempie man mano che arrivano i punti. */
function anello(quota, numero) {
  const raggio = 26;
  const giro = 2 * Math.PI * raggio;
  const piena = Math.max(0, Math.min(1, quota));
  const span = document.createElement('span');
  span.className = 'anello' + (piena >= 1 ? ' pieno' : '');
  span.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${raggio}" class="anello-fondo"/><circle cx="32" cy="32" r="${raggio}" class="anello-tratto" stroke-dasharray="${giro.toFixed(1)}" stroke-dashoffset="${(giro * (1 - piena)).toFixed(1)}" transform="rotate(-90 32 32)"/></svg><strong>${Number(numero) || 0}</strong>`;
  return span;
}

export function home(radice) {
  const prossima = dati.prossimaLezione();
  const daFare = dati.vociDaRipassareOggi().length;
  const iniziata = Object.keys(stato.leggi().voci).length > 0;
  const giorni = stato.ultimiGiorni(7);
  const punti = stato.puntiOggi();
  const obiettivo = stato.obiettivo();
  const fila = stato.giorniDiFila();
  const INIZIALI = ['D', 'L', 'M', 'M', 'G', 'V', 'S'];
  const iniziale = (data) => {
    const [a, m, g] = data.split('-').map(Number);
    return INIZIALI[new Date(a, m - 1, g).getDay()];
  };
  const saluto = daFare > 0 ? `Oggi hai ${plurale(daFare, 'voce', 'voci')} da ripassare.` : iniziata ? 'Niente in scadenza: avanti con una lezione nuova.' : 'Cominciamo da "io" e "tu". Bastano due minuti.';

  metti(
    radice,
    h('header', { class: 'testa' }, h('div', {}, h('h1', {}, 'Namaste'), h('p', { class: 'sotto' }, saluto))),
    avvisoVoce(),
    stato.salvataggioOk() ? null : h('div', { class: 'banner' }, 'Il telefono non permette di salvare i progressi (memoria piena o navigazione in incognito).'),
    // Obiettivo del giorno: punti di oggi e serie.
    h(
      'section',
      { class: 'scheda obiettivo' },
      anello(punti / obiettivo, punti),
      h(
        'div',
        {},
        h('h2', {}, punti >= obiettivo ? 'Obiettivo raggiunto' : 'Obiettivo di oggi'),
        h('p', { class: 'sotto' }, punti >= obiettivo ? `${punti} punti: ogni lezione in più è tutta in regalo.` : `${punti} di ${obiettivo} punti. Una lezione ne vale 10.`),
        h('p', { class: 'serie-riga' }, icona('fuoco'), fila > 0 ? `${plurale(fila, 'giorno', 'giorni')} di fila` : 'Fai una lezione per cominciare la serie'),
      ),
    ),
    // La settimana: un segno per ogni giorno in cui hai studiato.
    h(
      'section',
      { class: 'settimana', 'aria-label': 'Ultimi sette giorni' },
      ...giorni.map((g, k) =>
        h('div', { class: 'giorno' + (g.attivo ? ' attivo' : '') + (k === giorni.length - 1 ? ' oggi' : '') }, h('span', { class: 'giorno-punto' }, g.attivo ? icona('ok') : null), h('span', { class: 'giorno-nome' }, k === giorni.length - 1 ? 'oggi' : iniziale(g.data))),
      ),
    ),
    // Se c'è del ripasso in scadenza viene prima: è la cosa che fa ricordare di più.
    daFare > 0
      ? h(
          'section',
          { class: 'scheda scheda-riga' },
          h('div', {}, h('h2', {}, 'Ripasso di oggi'), h('p', { class: 'sotto' }, `${plurale(daFare, 'voce', 'voci')} in scadenza, ${Math.min(daFare, 8)} alla volta`)),
          h('button', { class: 'btn btn-primario btn-stretto', type: 'button', onclick: () => vai('ripasso') }, 'Ripassa'),
        )
      : null,
    prossima
      ? h(
          'section',
          { class: 'scheda scheda-forte' },
          h('p', { class: 'etichetta' }, iniziata ? 'Prossima tappa' : 'Comincia da qui'),
          h('h2', {}, prossima.lezione.titolo),
          h('p', { class: 'sotto' }, `${prossima.livello.titolo}, ${plurale(prossima.lezione.voci.length, 'voce', 'voci')}, 10 punti`),
          h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('lezione/' + prossima.lezione.id) }, iniziata ? 'Continua' : 'Inizia'),
          h('button', { class: 'btn-testo btn-testo-chiaro', type: 'button', onclick: () => vai('dispensa/' + (prossima.lezione.origine || prossima.lezione.id)) }, 'Prima leggi la dispensa'),
        )
      : h('section', { class: 'scheda scheda-forte' }, h('h2', {}, 'Hai completato tutto il percorso'), h('p', { class: 'sotto' }, 'Continua con il ripasso, oppure rifai un capitolo.'), h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('livelli') }, 'Vai al percorso')),
    // Solo la prima volta: come funziona, e una prova dell'audio prima di cominciare.
    iniziata
      ? null
      : h(
          'section',
          { class: 'scheda' },
          h('h2', {}, 'Come funziona'),
          h('p', {}, 'Ogni tappa ha tre parole: le ascolti, le abbini, fai un quiz. Due minuti e hai finito.'),
          h('p', { class: 'sotto' }, 'Quelle che non ricordi tornano da sole nel ripasso, finché restano.'),
          h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => parla('नमस्ते') }, icona('audio'), 'Prova l\'audio'),
        ),
  );
}

// ---------- Livelli e lezioni ----------

export function livelli(radice) {
  const prossima = dati.prossimaLezione();

  // Un capitolo sul percorso: la sua barra (titolo + dispensa) e una tappa per ogni lezione,
  // più la tappa finale del ripasso.
  const bloccoCapitolo = (capitolo) => {
    const { parti } = dati.trovaCapitolo(capitolo.id);
    const fatte = parti.filter(dati.lezioneFatta).length;
    const tutteFatte = fatte === parti.length;
    const studiate = capitolo.voci.filter((v) => stato.leggiVoce(v.id).scatola >= 1).length;
    const tappe = parti.map((parte, k) => {
      const fatta = dati.lezioneFatta(parte);
      const eProssima = Boolean(prossima && prossima.lezione.id === parte.id);
      return h(
        'li',
        {},
        eProssima ? h('span', { class: 'tappa-fumetto' }, fatte > 0 || studiate > 0 ? 'Continua' : 'Inizia') : null,
        h(
          'button',
          { class: 'tappa' + (fatta ? ' fatta' : '') + (eProssima ? ' prossima' : ''), type: 'button', 'aria-label': `${capitolo.titolo}, lezione ${k + 1} di ${parti.length}${fatta ? ', fatta' : ''}`, onclick: () => vai('lezione/' + parte.id) },
          icona(fatta ? 'ok' : 'stella'),
        ),
      );
    });
    tappe.push(
      h(
        'li',
        {},
        h('button', { class: 'tappa tappa-ripasso' + (tutteFatte ? ' pronta' : ''), type: 'button', disabled: studiate === 0, 'aria-label': 'Ripasso del capitolo ' + capitolo.titolo, onclick: () => vai('ripasso-capitolo/' + capitolo.id) }, icona('ripeti')),
        h('span', { class: 'tappa-nome' }, 'Ripasso'),
      ),
    );
    return h(
      'section',
      { class: 'capitolo-percorso' },
      h(
        'div',
        { class: 'capitolo-barra' + (tutteFatte ? ' fatto' : '') },
        h('div', { class: 'capitolo-titolo' }, h('strong', {}, capitolo.titolo), h('span', {}, tutteFatte ? 'Capitolo completato' : `${fatte} di ${plurale(parti.length, 'lezione', 'lezioni')}`)),
        h('button', { class: 'btn btn-piccolo btn-dispensa', type: 'button', onclick: () => vai('dispensa/' + capitolo.id) }, icona('libro'), 'Dispensa'),
      ),
      h('ol', { class: 'tappe' }, ...tappe),
    );
  };

  const sezioni = dati.tuttiILivelli().map((livello, i) => {
    const aperto = dati.livelloSbloccato(i);
    const avanzamento = dati.avanzamentoLivello(livello);
    return h(
      'section',
      { class: 'parte' + (aperto ? '' : ' bloccata') },
      h('div', { class: 'livello-testa' }, h('div', {}, h('p', { class: 'etichetta' }, `Parte ${i + 1}`), h('h2', {}, livello.titolo)), h('p', { class: 'livello-pct' }, aperto ? pct(avanzamento) : icona('lucchetto'))),
      barra(avanzamento, `Avanzamento della parte ${i + 1}`),
      ...(aperto ? livello.capitoli.map(bloccoCapitolo) : [h('p', { class: 'suggerimento' }, `Si sblocca quando "${dati.tuttiILivelli()[i - 1].titolo}" è almeno all'80%.`)]),
    );
  });
  metti(radice, h('header', { class: 'testa' }, h('div', {}, h('h1', {}, 'Percorso'), h('p', { class: 'sotto' }, 'Una tappa alla volta. La dispensa di ogni capitolo è sempre lì accanto.'))), ...sezioni);
  // Si apre già sulla prossima tappa da fare.
  requestAnimationFrame(() => {
    const tappa = radice.querySelector('.tappa.prossima');
    if (tappa) tappa.scrollIntoView({ block: 'center' });
  });
}

// ---------- Dispensa di un capitolo ----------

/** La dispensa: regole, tabella riassuntiva e tutte le voci del capitolo, sempre con l'audio. */
export function dispensa(radice, idCapitolo) {
  const trovato = dati.trovaCapitolo(idCapitolo);
  if (!trovato) {
    vai('livelli');
    return;
  }
  const { capitolo, parti } = trovato;
  const tabella = capitolo.dispensa;
  const daFare = parti.find((p) => !dati.lezioneFatta(p)) || parti[0];
  const tutteFatte = parti.every(dati.lezioneFatta);
  const colonne = tabella ? tabella.colonne || [] : [];
  // Ogni riga: la prima cella è l'italiano, la seconda la forma hindi principale, le altre dettagli.
  const rigaTabella = (riga) =>
    h(
      'li',
      {},
      h(
        'div',
        { class: 'tab-testi' },
        h('p', { class: 'tab-it' }, riga.celle[0]),
        h('p', { class: 'tab-hi', lang: 'hi-Latn' }, colonne[1] && colonne[1] !== 'Hindi' ? h('span', { class: 'tab-nome' }, colonne[1] + ' ') : null, riga.celle[1]),
        ...riga.celle.slice(2).map((cella, k) => h('p', { class: 'tab-extra' }, h('span', { class: 'tab-nome' }, (colonne[k + 2] || '') + ' '), h('span', { lang: 'hi-Latn' }, cella))),
      ),
      riga.audio ? h('button', { class: 'btn btn-audio', type: 'button', 'aria-label': 'Ascolta', onclick: () => parla(riga.audio) }, icona('audio')) : null,
    );
  metti(
    radice,
    h('header', { class: 'testa' }, h('div', {}, h('button', { class: 'btn-testo indietro', type: 'button', onclick: () => vai('livelli') }, '‹ Percorso'), h('h1', {}, capitolo.titolo), h('p', { class: 'sotto' }, 'Dispensa: leggila, ascoltala, torna qui quando vuoi.'))),
    capitolo.spiegazione ? h('section', { class: 'scheda' }, h('p', { class: 'etichetta' }, 'La regola'), ...capitolo.spiegazione.split('\n').filter(Boolean).map((riga) => h('p', {}, riga))) : null,
    tabella
      ? h(
          'section',
          { class: 'scheda' },
          h('p', { class: 'etichetta' }, tabella.titolo || 'Tabella'),
          h('ul', { class: 'tabella' }, ...tabella.righe.map(rigaTabella)),
          ...(tabella.note || []).map((nota) => h('p', { class: 'carta-nota' }, nota)),
        )
      : null,
    h('section', {}, h('h2', { class: 'titolo-sezione' }, 'Tutte le voci del capitolo'), h('ul', { class: 'elenco-voci' }, ...capitolo.voci.map((v) => rigaVoce(v)))),
    h('button', { class: 'btn btn-primario', type: 'button', onclick: () => vai('lezione/' + daFare.id) }, tutteFatte ? 'Rifai le lezioni' : 'Vai alla lezione'),
  );
}

// ---------- Da ripassare ----------

export function daRipassare(radice) {
  const inScadenza = dati.vociDaRipassareOggi().length;
  const voci = dati.vociInListaRipasso();
  const elenco = h(
    'ul',
    { class: 'elenco-voci' },
    ...voci.map((voce) =>
      rigaVoce(
        voce,
        h(
          'button',
          {
            class: 'btn-icona',
            type: 'button',
            'aria-label': 'La so: togli dalla lista',
            title: 'La so: togli dalla lista',
            onclick: () => {
              stato.togliDaRipassare(voce.id);
              daRipassare(radice);
            },
          },
          icona('ok'),
        ),
      ),
    ),
  );
  metti(
    radice,
    h('header', { class: 'testa' }, h('div', {}, h('h1', {}, 'Ripasso'), h('p', { class: 'sotto' }, 'Poco e spesso: è il ripasso che fa restare le parole.'))),
    // Tutto il ripasso in un posto solo: prima quello in scadenza, poi le voci difficili.
    h(
      'section',
      { class: 'scheda scheda-riga' },
      h('div', {}, h('h2', {}, 'In scadenza oggi'), h('p', { class: 'sotto' }, inScadenza > 0 ? `${plurale(inScadenza, 'voce', 'voci')}, ${Math.min(inScadenza, 8)} alla volta` : 'Niente per ora. Torna più tardi o fai una lezione.')),
      inScadenza > 0 ? h('button', { class: 'btn btn-primario btn-stretto', type: 'button', onclick: () => vai('ripasso') }, 'Ripassa') : null,
    ),
    h('h2', { class: 'titolo-sezione' }, 'Le tue voci difficili'),
    voci.length > 0
      ? h('p', { class: 'suggerimento' }, 'Quelle sbagliate, incerte o segnate da te. Riascoltale qui; tocca il segno di spunta quando una la sai.')
      : h('div', { class: 'scheda vuota' }, h('p', {}, 'Nessuna, per ora.'), h('p', { class: 'suggerimento' }, 'Qui finiscono le voci che sbagli o su cui sei incerto. Puoi aggiungerne a mano con "Segna da ripassare" su qualsiasi carta.')),
    voci.length > 0 ? h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => vai('ripasso-lista') }, `Allenati su queste ${voci.length}`) : null,
    elenco,
  );
}

// ---------- Progressi ----------

export function progressi(radice) {
  const tutte = dati.tutteLeVoci();
  const imparate = dati.vociImparate().length;
  const studiate = tutte.filter((v) => stato.leggiVoce(v.id).scatola >= 1).length;
  const oggi = stato.statisticheOggi();
  const fila = stato.giorniDiFila();
  const scatole = [1, 2, 3, 4, 5].map((s) => tutte.filter((v) => stato.leggiVoce(v.id).scatola === s).length);
  const massimo = Math.max(1, ...scatole);
  const riquadro = (numero, testo) => h('div', { class: 'riquadro' }, h('p', { class: 'numero' }, String(numero)), h('p', { class: 'sotto' }, testo));

  metti(radice, 
    h('header', { class: 'testa' }, h('div', {}, h('h1', {}, 'Progressi'))),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Voci imparate'),
      h('p', { class: 'riga-progressi' }, h('strong', {}, `${imparate} di ${tutte.length}`), ` · ${studiate} studiate`),
      barra(tutte.length ? imparate / tutte.length : 0, 'Voci imparate'),
      h('p', { class: 'suggerimento' }, 'Una voce è "imparata" quando l\'hai ricordata in più ripassi (scatola 3 o più).'),
    ),
    h(
      'div',
      { class: 'griglia' },
      riquadro(stato.puntiOggi(), 'punti oggi'),
      riquadro(stato.puntiTotali(), 'punti in tutto'),
      riquadro(fila, fila === 1 ? 'giorno di fila' : 'giorni di fila'),
      riquadro(dati.vociDaRipassareOggi().length, 'da ripassare oggi'),
      riquadro(oggi.minuti, oggi.minuti === 1 ? 'minuto oggi' : 'minuti oggi'),
      riquadro(oggi.sessioni, oggi.sessioni === 1 ? 'sessione oggi' : 'sessioni oggi'),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Per livello'),
      ...dati.tuttiILivelli().map((livello, i) => {
        const a = dati.avanzamentoLivello(livello);
        return h('div', { class: 'riga-livello' }, h('p', {}, h('span', {}, `${i + 1}. ${livello.titolo}`), h('strong', {}, dati.livelloSbloccato(i) ? pct(a) : 'bloccato')), barra(a, livello.titolo));
      }),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Scatole di ripasso'),
      h('p', { class: 'suggerimento' }, 'Ogni risposta giusta sposta la voce nella scatola successiva, che si ripassa più di rado: subito, dopo 1, 3, 7 e 14 giorni.'),
      h('div', { class: 'scatole' }, ...scatole.map((quante, i) => h('div', { class: 'scatola' }, h('span', { class: 'scatola-n' }, String(quante)), h('div', { class: 'scatola-colonna' }, h('div', { style: `height:${Math.round((quante / massimo) * 100)}%` })), h('span', { class: 'sotto' }, String(i + 1))))),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Voce per voce'),
      h('p', { class: 'suggerimento' }, 'Tocca un capitolo per vedere a che punto è ogni parola o frase.'),
      ...dati.tuttiILivelli().flatMap((livello) =>
        livello.capitoli.map((lezione) => {
          const sapute = lezione.voci.filter((v) => stato.leggiVoce(v.id).scatola >= stato.SCATOLA_IMPARATA).length;
          const viste = lezione.voci.filter((v) => stato.leggiVoce(v.id).scatola >= 1).length;
          return h(
            'details',
            { class: 'dettaglio-lezione' },
            h('summary', {}, h('span', {}, lezione.titolo), h('span', { class: 'sotto' }, viste === 0 ? 'da fare' : `${sapute} imparate · ${viste} di ${lezione.voci.length} studiate`)),
            h('ul', {}, ...lezione.voci.map((voce) => h('li', {}, h('span', {}, h('strong', { lang: 'hi-Latn' }, voce.translit), h('span', { class: 'sotto' }, voce.it)), etichettaStato(voce)))),
          );
        }),
      ),
    ),
  );
}

/** Piccola etichetta con lo stato di una voce: nuova, da ripassare, in corso, imparata. */
function etichettaStato(voce) {
  const v = stato.leggiVoce(voce.id);
  if (v.scatola === 0) return h('span', { class: 'stato stato-nuova' }, 'nuova');
  if (v.debole) return h('span', { class: 'stato stato-debole' }, 'da ripassare');
  if (v.scatola >= stato.SCATOLA_IMPARATA) return h('span', { class: 'stato stato-imparata' }, `imparata · ${v.scatola}/5`);
  return h('span', { class: 'stato stato-corso' }, `in corso · ${v.scatola}/5`);
}

// ---------- Come si legge ----------

// Esempi con il testo hindi nascosto: serve solo a far leggere l'esempio alla voce.
const SUONI = [
  ['Vocali', [
    ['a', 'breve e un po\' chiusa, più rapida della nostra "a"', 'namaste', 'नमस्ते'],
    ['aa', '"a" lunga e aperta, come in "mare"', 'naam (nome)', 'नाम'],
    ['i · ii', '"i" breve · "i" lunga', 'din (giorno) · tiin (tre)', 'दिन, तीन'],
    ['u · uu', '"u" breve · "u" lunga', 'subah (mattina) · duudh (latte)', 'सुबह, दूध'],
    ['e', 'sempre chiusa e lunga, come in "sera"', 'ek (uno)', 'एक'],
    ['o', 'sempre chiusa e lunga, come in "sole"', 'do (due)', 'दो'],
    ['ai', 'una sola "e" aperta, come in "caffè" (non "a-i")', 'hai (è)', 'है'],
    ['au', 'una sola "o" aperta, come in "però" (non "a-u")', 'aur (e) · sau (cento)', 'और, सौ'],
  ]],
  ['Consonanti', [
    ['kh gh th dh ph bh', 'la consonante seguita da un soffio d\'aria. "th" non è il "th" inglese: è una "t" soffiata', 'thiik (bene) · dhanyavaad · phal (frutta)', 'ठीक, धन्यवाद, फल'],
    ['ch · chh', '"c" di "cena" · la stessa, ma soffiata', 'chaay (tè) · chhah (sei)', 'चाय, छह'],
    ['j', '"g" di "gelato"', 'jii · aaj (oggi)', 'जी, आज'],
    ['g', 'sempre dura, come in "gatto"', 'ghar (casa)', 'घर'],
    ['sh', '"sc" di "scena"', 'shaam (sera)', 'शाम'],
    ['y', '"i" di "ieri"', 'kyaa (cosa)', 'क्या'],
    ['v', 'morbida, a metà tra "v" e "u"', 'svaagat (benvenuto)', 'स्वागत'],
    ['z', '"s" sonora di "rosa"', 'sabzii (verdura)', 'सब्ज़ी'],
    ['h', 'da sola si sente sempre, come un leggero soffio', 'haan (sì)', 'हाँ'],
    ['n finale', 'dopo una vocale lunga (main, hain, haan, nahiin, kahaan, huun) non si pronuncia: rende la vocale nasale, come nel francese "bon"', 'nahiin (no) · main (io)', 'नहीं, मैं'],
    ['t · d', 'a volte si dicono con la punta della lingua piegata all\'indietro; una "d" tra due vocali suona quasi come una "r" rapida. Qui fidati dell\'audio', 'sadak (strada) · thodii (un po\')', 'सड़क, थोड़ी'],
    ['doppie', 'si allungano, come in italiano', 'bachchaa (bambino) · sattar (70)', 'बच्चा, सत्तर'],
  ]],
];

export function comeSiLegge(radice) {
  metti(radice, 
    h('header', { class: 'testa' }, h('div', {}, h('button', { class: 'btn-testo indietro', type: 'button', onclick: () => vai('altro') }, '‹ Altro'), h('h1', {}, 'Come si legge'))),
    h(
      'section',
      { class: 'scheda' },
      h('p', {}, 'L\'hindi qui è scritto in lettere latine, con uno schema semplice pensato per chi legge in italiano.'),
      h('p', {}, h('strong', {}, 'La regola d\'oro: '), 'una vocale scritta doppia è lunga (aa, ii, uu), una scritta singola è breve. Tutto il resto si legge quasi come in italiano, con le eccezioni qui sotto.'),
      h('p', { class: 'suggerimento' }, 'L\'accento è leggero: più che calcare una sillaba, allunga le vocali doppie. Tocca l\'altoparlante per sentire ogni esempio.'),
    ),
    ...SUONI.map(([titolo, righe]) =>
      h(
        'section',
        { class: 'scheda' },
        h('p', { class: 'etichetta' }, titolo),
        h(
          'ul',
          { class: 'suoni' },
          ...righe.map(([segno, spiegazione, esempio, nascosto]) =>
            h(
              'li',
              {},
              h('div', {}, h('p', { class: 'suono-segno', lang: 'hi-Latn' }, segno), h('p', {}, spiegazione), h('p', { class: 'suono-esempio', lang: 'hi-Latn' }, esempio)),
              h('button', { class: 'btn btn-audio', type: 'button', 'aria-label': 'Ascolta l\'esempio', onclick: () => parla(nascosto) }, icona('audio')),
            ),
          ),
        ),
      ),
    ),
    h('section', { class: 'scheda' }, h('p', { class: 'etichetta' }, 'Parole inglesi'), h('p', {}, 'L\'hindi che si parla oggi è pieno di parole inglesi: l\'app insegna quelle che si usano davvero, scritte come suonano con lo stesso schema (gud naait = good night, sorii = sorry, pliiz = please). Quando esiste una parola hindi più formale, la trovi nella nota.')),
    h('section', { class: 'scheda' }, h('p', { class: 'etichetta' }, 'Uomo o donna'), h('p', {}, 'In hindi molti verbi cambiano se chi parla è un uomo o una donna (-aa al maschile, -ii al femminile). Le frasi dell\'app usano la forma maschile; quando esiste una forma femminile diversa, una nota la riporta.')),
  );
}

// ---------- Altro: tema, audio, backup ----------

export function altro(radice, { applicaTema }) {
  const temaAttuale = stato.leggi().impostazioni.tema;
  const testiVoce = {
    ok: 'Voce hindi trovata.',
    mancante: 'Sul telefono non risulta una voce hindi.',
    sconosciuto: 'Il telefono non comunica quali voci ha: prova l\'audio qui sotto.',
    'non-supportato': 'Questo browser non ha la sintesi vocale.',
  };
  const selettore = h('input', { type: 'file', accept: 'application/json,.json', class: 'nascosto', 'aria-hidden': 'true', tabindex: '-1' });
  selettore.addEventListener('change', async () => {
    const file = selettore.files[0];
    selettore.value = '';
    if (!file) return;
    try {
      const testo = await file.text();
      if (!window.confirm('Importare questo backup? I progressi attuali verranno sostituiti.')) return;
      stato.importa(testo);
      applicaTema();
      avviso('Progressi ripristinati.');
      altro(radice, { applicaTema });
      window.dispatchEvent(new Event('progressi-cambiati'));
    } catch (e) {
      avviso(e.message || 'Importazione non riuscita.');
    }
  });

  function esporta() {
    const blob = new Blob([stato.esporta()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = h('a', { href: url, download: `hindi-progressi-${stato.oggi()}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    avviso('Backup salvato nei download.');
  }

  metti(radice, 
    h('header', { class: 'testa' }, h('div', {}, h('h1', {}, 'Altro'))),
    h('button', { class: 'scheda scheda-link', type: 'button', onclick: () => vai('come-si-legge') }, h('span', {}, h('strong', {}, 'Come si legge'), h('span', { class: 'sotto' }, 'Lo schema della traslitterazione, con esempi audio')), icona('freccia')),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Tema'),
      h(
        'div',
        { class: 'segmenti', role: 'group', 'aria-label': 'Tema' },
        ...[['auto', 'Automatico'], ['chiaro', 'Chiaro'], ['scuro', 'Scuro']].map(([valore, nome]) =>
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': String(temaAttuale === valore),
              onclick: () => {
                stato.impostaTema(valore);
                applicaTema();
                altro(radice, { applicaTema });
              },
            },
            nome,
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Obiettivo del giorno'),
      h('p', { class: 'suggerimento' }, 'Quanti punti vuoi fare ogni giorno. Una lezione ne vale 10, un ripasso da 5 in su.'),
      h(
        'div',
        { class: 'segmenti', role: 'group', 'aria-label': 'Obiettivo del giorno' },
        ...[10, 20, 30, 50].map((valore) =>
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': String(stato.obiettivo() === valore),
              onclick: () => {
                stato.impostaObiettivo(valore);
                altro(radice, { applicaTema });
              },
            },
            String(valore),
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Esercizio di pronuncia'),
      h('p', { class: 'suggerimento' }, 'Alla fine di ogni lezione ripeti le parole al microfono. Serve internet e il permesso al microfono.'),
      h(
        'div',
        { class: 'segmenti', role: 'group', 'aria-label': 'Esercizio di pronuncia' },
        ...[[true, 'Attivo'], [false, 'Spento']].map(([valore, nome]) =>
          h(
            'button',
            {
              type: 'button',
              'aria-pressed': String((stato.leggi().impostazioni.pronuncia !== false) === valore),
              onclick: () => {
                stato.impostaPronuncia(valore);
                altro(radice, { applicaTema });
              },
            },
            nome,
          ),
        ),
      ),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Audio'),
      h('p', {}, testiVoce[statoVoceHindi()]),
      h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => parla('नमस्ते, आप कैसे हैं?') }, icona('audio'), 'Prova l\'audio'),
      h('details', {}, h('summary', {}, 'Non sento niente o la voce è strana'), h('p', { class: 'suggerimento' }, 'Controlla il volume dei contenuti multimediali, poi installa la voce hindi:'), istruzioniVoce()),
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Backup dei progressi'),
      h('p', { class: 'suggerimento' }, 'I progressi sono salvati solo su questo telefono. Esporta ogni tanto un file di backup: ti serve se cambi telefono o cancelli i dati di Chrome.'),
      h('div', { class: 'coppia' }, h('button', { class: 'btn btn-secondario', type: 'button', onclick: esporta }, 'Esporta'), h('button', { class: 'btn btn-secondario', type: 'button', onclick: () => selettore.click() }, 'Importa')),
      selettore,
    ),
    h(
      'section',
      { class: 'scheda' },
      h('p', { class: 'etichetta' }, 'Ricominciare'),
      h(
        'button',
        {
          class: 'btn btn-pericolo',
          type: 'button',
          onclick: () => {
            if (!window.confirm('Cancellare tutti i progressi? Non si può annullare (salvo importare un backup).')) return;
            stato.azzera();
            avviso('Progressi azzerati.');
            window.dispatchEvent(new Event('progressi-cambiati'));
          },
        },
        'Azzera i progressi',
      ),
    ),
  );
}

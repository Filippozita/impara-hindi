# Namaste · Impara l'hindi

App personale (PWA) per imparare l'hindi partendo dall'italiano. Pensata per il telefono, funziona offline, salva i progressi sul dispositivo. Nessun backend, nessun login, nessuna dipendenza da installare.

A schermo compaiono solo la traslitterazione in lettere latine e la traduzione italiana. Il testo in devanagari resta nei dati, nascosto: serve alla sintesi vocale e al confronto del riconoscimento vocale.

## Com'è fatta

| File | A cosa serve |
| --- | --- |
| `contenuti.json` | **Tutti i contenuti**: livelli → lezioni → voci. È l'unico file da toccare per aggiungere materiale. |
| `index.html`, `css/stile.css` | Pagina e aspetto (colori del tema in cima al CSS). |
| `js/app.js` | Avvio, navigazione, tema, tempo di studio. |
| `js/dati.js` | Lettura dei contenuti, sblocco dei livelli. |
| `js/stato.js` | Progressi in localStorage, scatole Leitner, serie di giorni, backup. |
| `js/lezione.js` | Svolgimento di lezione e ripasso. |
| `js/schermate.js` | Home, Lezioni, Da ripassare, Progressi, Come si legge, Altro. |
| `js/audio.js` | Sintesi vocale (voce `hi-IN`). |
| `js/voce.js` | Riconoscimento vocale, confronto (Levenshtein), traslitterazione. |
| `sw.js`, `manifest.webmanifest`, `icone/` | Installazione sulla home e uso offline. |
| `strumenti/` | Server di prova e controllo dei contenuti. |

## Aggiungere voci, lezioni o livelli

Si modifica solo `contenuti.json`. La struttura è:

```json
{
  "livelli": [
    {
      "id": "l4",
      "titolo": "In viaggio",
      "descrizione": "Treni, taxi, alberghi.",
      "lezioni": [
        {
          "id": "l4-treno",
          "titolo": "In treno",
          "spiegazione": "Testo facoltativo mostrato prima della lezione.",
          "voci": [
            {
              "id": "l4-tikat",
              "it": "biglietto",
              "translit": "tikat",
              "devanagari": "टिकट",
              "tipo": "parola",
              "nota": "Facoltativa: una riga di spiegazione."
            }
          ]
        }
      ]
    }
  ]
}
```

Regole:

- Ogni `id` (di livello, lezione e voce) deve essere **unico** e non va più cambiato: i progressi sono legati agli id.
- Ogni lezione ha da 5 a 10 voci (minimo 4, servono per le risposte del quiz).
- `tipo` è `"parola"` oppure `"frase"`.
- `devanagari` è obbligatorio e non viene mai mostrato. `it`, `translit` e `nota` non devono contenere devanagari.
- `translit` segue lo schema della schermata "Come si legge" (vocali lunghe doppie: `aa`, `ii`, `uu`).
- Facoltativo: `"alternative": ["21"]` elenca altri testi accettati dall'esercizio di pronuncia (utile per i numeri, che il riconoscimento vocale scrive spesso in cifre).
- Dove la frase cambia tra uomo e donna, si usa la forma maschile e lo si dice nella `nota`.
- Un nuovo livello va aggiunto in fondo a `livelli`: si sblocca quando il precedente è almeno all'80%.

Poi:

```bash
node strumenti/controlla-contenuti.mjs
```

```bash
git add contenuti.json && git commit -m "Nuovi contenuti" && git push
```

Dopo un paio di minuti il sito è aggiornato. Sul telefono basta aprire l'app con internet attivo: i contenuti nuovi vengono scaricati subito. (Le modifiche al *codice*, invece, si vedono alla seconda apertura.)

Si può fare tutto anche dal sito di GitHub, senza computer: apri `contenuti.json`, tocca la matita, modifica e conferma.

## Provarla sul computer

```bash
node strumenti/server.mjs
```

e apri <http://localhost:5173>.

## Pubblicazione

A ogni push su `main` il workflow `.github/workflows/pubblica.yml` controlla i contenuti e pubblica il repository su GitHub Pages.

Se modifichi il codice (non i contenuti) e vuoi forzare l'aggiornamento sui telefoni, cambia `VERSIONE` in `sw.js`; se aggiungi o rinomini un file dell'app, aggiornalo anche nell'elenco `FILE` dello stesso file.

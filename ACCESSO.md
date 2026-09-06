# Attivare l'accesso — Adrenalina

Finché non fai questi passaggi **l'app funziona come sempre**: tutto in locale,
nessun login, nessuna rete. L'accesso si accende solo compilando la
configurazione al punto 4.

Serve un account Google. Tempo: una ventina di minuti.

---

## 1. Creare il progetto

1. Vai su `console.firebase.google.com` e accedi.
2. **Crea un progetto** → nome: `adrenalina` → Continua.
3. Google Analytics: **disattivalo**. Non serve e aggiunge tracciamento.
4. Attendi la creazione, poi **Continua**.

## 2. Attivare l'accesso con Google

1. Menu a sinistra → **Authentication** → **Inizia**.
2. Scheda **Sign-in method** → **Google** → attiva l'interruttore.
3. Email di assistenza: scegli la tua. → **Salva**.

## 3. Autorizzare l'indirizzo dell'app

Senza questo passaggio il login fallisce con «unauthorized domain».

1. **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → scrivi `alessandrozanetta80-boop.github.io` → Aggiungi.

`localhost` di solito c'è già: serve per provare dal computer.

## 4. Prendere la configurazione e metterla nell'app

1. Ingranaggio in alto a sinistra → **Impostazioni progetto**.
2. In fondo, **Le tue app** → icona `</>` (**Web**).
3. Nome app: `Adrenalina` → **Registra app** (non serve l'hosting Firebase).
4. Compare un riquadro con `firebaseConfig`. Ti servono quattro valori:
   `apiKey`, `authDomain`, `projectId`, `appId`.
5. Apri il file **`firebase.js`** del pacchetto e incollali:

```js
var CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'adrenalina-xxxx.firebaseapp.com',
  projectId: 'adrenalina-xxxx',
  appId: '1:123456789:web:abc123'
};
```

6. Nello stesso file scrivi le email dei tre amministratori:

```js
var AMMINISTRATORI = [
  'alessandro.zanetta@gmail.com',
  'stefano.bianchi@gmail.com',
  'luca.malcotti@gmail.com'
];
```

**Questi valori non sono segreti.** Identificano il progetto, non
autorizzano niente. Chi protegge i dati sono le regole del punto 6.

L'elenco `AMMINISTRATORI` serve solo a decidere cosa mostrare
nell'interfaccia. Il permesso di scrivere lo dà il punto 6.

7. Carica `firebase.js` aggiornato su GitHub.

## 5. Creare il database

1. Menu → **Firestore Database** → **Crea database**.
2. Modalità: **Avvia in modalità di produzione** (chiuso a tutti; apriremo
   noi al punto 6).
3. Località: **eur3 (europe-west)**. I dati restano in Europa.

## 6. Caricare le regole di sicurezza

**Questo è il passaggio che protegge davvero i dati.**

1. **Firestore Database** → scheda **Regole**.
2. Cancella tutto e incolla il contenuto del file **`firestore.rules`**
   del pacchetto.
3. **Pubblica**.

Da questo momento: chi non ha fatto l'accesso non vede niente, chi l'ha
fatto legge, e scrive solo chi è elencato al punto 7.

## 7. Dire al database chi sono gli amministratori

Le regole cercano un documento con l'identificativo dell'account. Per
ognuno dei tre amministratori:

1. Fai fare a quella persona **un primo accesso** all'app (dopo il punto 4).
2. **Authentication** → **Users**: compare la riga con la sua email.
   Copia il valore della colonna **User UID**.
3. **Firestore Database** → **Avvia raccolta** → ID raccolta:
   `amministratori`.
4. **ID documento**: incolla lo **UID**. Aggiungi un campo qualsiasi, per
   esempio `email` (stringa) con la sua email, così sai chi è.
5. **Salva**. Ripeti per gli altri due.

Per togliere un amministratore basta cancellare il suo documento.

---

## Provare che funziona

- **Apri l'app in una finestra anonima**: deve chiedere l'accesso.
- **Entra con un account non amministratore**: deve dire «Socio · sola lettura».
- **Entra con un amministratore**: deve dire «Amministratore · puoi modificare i dati».

## Cosa NON è ancora attivo

I dati **non si sincronizzano ancora**: restano sul telefono di ciascuno.
Questo passaggio serve solo a stabilire chi è chi. La sincronizzazione è
il blocco successivo.

## Se qualcosa va storto

**«unauthorized domain»** → manca il punto 3.

**Il login si apre e si chiude subito** → su alcuni browser di telefono la
finestra viene bloccata. L'app ripiega da sola sul reindirizzamento; se
insiste, prova con Chrome.

**Voglio tornare indietro** → svuota i quattro valori in `firebase.js` e
ricarica il file. L'app torna a funzionare in locale senza login, e i dati
sul telefono restano dove sono.

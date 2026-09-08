# Accendere Firebase — Adrenalina 0.8.0

Finché non fai questi passaggi l'app funziona come sempre: tutto sul
telefono, nessun login, nessuna rete. Niente di quello che segue è
irreversibile fino al punto 9.

Serve un account Google. Tempo: circa un'ora, con calma.

---

## 1. Creare il progetto

1. `console.firebase.google.com` → accedi.
2. **Crea un progetto** → nome `adrenalina` → Continua.
3. Google Analytics: **disattivalo**.
4. Attendi e clicca **Continua**.

## 2. Attivare l'accesso con Google

1. Menu a sinistra → **Authentication** → **Inizia**.
2. Scheda **Sign-in method** → **Google** → attiva l'interruttore.
3. Email di assistenza: la tua → **Salva**.

## 3. Autorizzare l'indirizzo dell'app

Senza questo il login fallisce con «unauthorized domain».

1. **Authentication** → **Settings** → **Authorized domains**.
2. **Add domain** → `alessandrozanetta80-boop.github.io` → Aggiungi.

`localhost` di solito c'è già.

## 4. Creare il database

1. Menu → **Firestore Database** → **Crea database**.
2. **Avvia in modalità di produzione** (chiuso a tutti: apriamo noi al punto 6).
3. Località: **eur3 (europe-west)**. I dati restano in Europa.

## 5. Copiare la configurazione nell'app

1. Ingranaggio in alto a sinistra → **Impostazioni progetto**.
2. In fondo, **Le tue app** → icona `</>` (**Web**).
3. Nome `Adrenalina` → **Registra app** (l'hosting Firebase non serve).
4. Compare `firebaseConfig`. Ti servono quattro valori.
5. Apri **`firebase.js`** e incollali:

```js
var CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'adrenalina-xxxx.firebaseapp.com',
  projectId: 'adrenalina-xxxx',
  appId: '1:123456789:web:abc123'
};
```

6. Carica `firebase.js` su GitHub.

**Questi valori non sono segreti** e non autorizzano niente: identificano
il progetto. Chi protegge i dati sono le regole del punto 6.

**Nel file non c'è nessun elenco di persone.** Chi entra lo decide solo il
database, al punto 7.

## 6. Pubblicare le regole di sicurezza

**Questo è il passaggio che protegge i dati.**

1. **Firestore Database** → scheda **Regole**.
2. Cancella tutto e incolla il contenuto di **`firestore.rules`**.
3. **Pubblica**.

Da adesso entrano solo le persone elencate al punto 7. Chiunque altro,
anche autenticato con Google, non legge e non scrive niente.

### Verificare che siano attive

1. Apri l'app in una finestra anonima: deve chiedere l'accesso.
2. Entra con un account qualsiasi non ancora abilitato: deve comparire
   **«Accesso non consentito»** e nessun dato.

Se invece entra e vede i dati, le regole non sono state pubblicate.

## 7. Creare i tre accessi iniziali

Questa è **l'unica volta** in cui si tocca la Console per gli accessi.
Dopo, tutto si gestisce dall'app.

Per ognuno dei tre — **Alessandro Zanetta**, **Stefano Bianchi**,
**Luca Malcotti**:

1. Fai fare a quella persona **un primo tentativo di accesso** all'app.
   Verrà respinta: è normale, serve solo a creare l'account.
2. **Authentication** → **Users**: compare la riga con la sua email.
   Copia il valore della colonna **User UID**.
3. **Firestore Database** → **Avvia raccolta** → ID raccolta: **`accessi`**
   (la prima volta; dalle successive scegli la raccolta già esistente).
4. **ID documento**: incolla lo **UID**, esattamente com'è.
5. Aggiungi questi campi, con questi nomi esatti:

| Campo | Tipo | Valore |
|---|---|---|
| `uid` | string | lo stesso UID del documento |
| `email` | string | l'email Google di quella persona |
| `ruolo` | string | `AMMINISTRATORE` |
| `creatoDa` | string | lo stesso UID |
| `creatoIl` | timestamp | premi «now» |
| `modificatoDa` | string | lo stesso UID |
| `modificatoIl` | timestamp | premi «now» |

6. **Salva**. Ripeti per gli altri due.

Attenzione a `ruolo`: deve essere scritto **in maiuscolo**, esattamente
`AMMINISTRATORE`. L'altro valore possibile è `LETTORE`, ma quello lo
assegnerà l'app.

### Da qui in poi la Console non serve più

Nuovi accessi, promozioni e revoche si fanno **dall'app**: Home →
**Gestione accessi**. Chi non è autorizzato preme «Richiedi accesso»
dalla schermata di blocco e un amministratore decide.

Nessuno può modificare il proprio accesso: né promuoversi né revocarsi.
Serve sempre un altro amministratore. È voluto: evita che la squadra
resti senza nessuno che possa gestire gli altri.

## 8. Scegliere il telefono master

L'archivio della squadra viene creato **una volta sola**, da **un solo
telefono**. Scegli quello che ha i dati buoni: normalmente il tuo.

Prima di procedere, su quel telefono:

- apri l'app e controlla che i soci, le giornate e i capi siano giusti;
- **Backup dati → Esporta** e salva il file da qualche parte.

## 9. Inizializzare l'archivio condiviso

Da qui in poi si scrive davvero sul database.

Sul telefono master, entrato come amministratore:
**Backup dati → Sincronizzazione → Inizializza archivio condiviso**.

L'app fa da sola, in quest'ordine: controlla di poter procedere, verifica
che il database sia vuoto, crea un backup di sicurezza, controlla la
coerenza dei dati, allinea i contatori dei codici capo, carica tutto,
verifica che i conteggi coincidano e marca l'archivio come inizializzato.

Se qualcosa non torna si ferma **prima** di scrivere e ti dice perché.

Dettagli in `MIGRAZIONE-INIZIALE.md`.

## 10. Collegare il secondo e il terzo telefono

Su un telefono che **non ha mai usato l'app**:

1. apri l'indirizzo;
2. accedi con Google;
3. l'app scarica l'archivio della squadra e basta.

Nessun dato dimostrativo, nessun caricamento.

**Se il telefono ha già usato l'app in locale**, l'app se ne accorge e non
mescola niente. Dovrai scegliere esplicitamente **«Usa archivio
condiviso»**: prima viene creato un backup, poi i dati locali vengono
sostituiti con quelli della squadra. Quello che c'era resta nel backup.

## 11. Verificare che funzioni

**Da A verso B.** Sul telefono A apri una giornata e segna un
partecipante. Su B apri la stessa giornata: deve comparire entro pochi
secondi. Se non compare, su B: Backup dati → Sincronizzazione →
**Sincronizza ora**.

**Da B verso A.** Ripeti al contrario.

**Offline.** Su A metti la modalità aereo, segna due partecipanti, controlla
che restino. In Sincronizzazione devi vedere «in attesa di partire: 2».
Togli la modalità aereo: entro pochi secondi devono partire da sole, e B
deve vederle.

**Revoca.** Cancella dalla console il documento di un amministratore in
`accessi`. Su quel telefono, alla prossima apertura, deve comparire
«Accesso non consentito». I suoi dati locali restano dove sono.

## Se qualcosa va storto

**«unauthorized domain»** → manca il punto 3.

**Il login si apre e si chiude subito** → su alcuni browser di telefono la
finestra viene bloccata. L'app ripiega da sola sul reindirizzamento; se
insiste, prova con Chrome.

**«Accesso non consentito» a un amministratore vero** → controlla che lo
UID nel documento sia esattamente quello di **Authentication → Users**, senza
spazi.

**Voglio tornare indietro** → svuota i quattro valori in `firebase.js` e
ricarica il file. L'app torna locale e i dati sui telefoni restano dove
sono. L'archivio su Firebase resta lì, intatto.

# Scritture nel database locale — vie e eccezioni

Questo documento serve a rispondere a una domanda sola: **una modifica
può finire in IndexedDB senza passare dalla coda di sincronizzazione?**

La risposta deve essere no, tranne che nei quattro casi tecnici elencati
in fondo. Il test `RC28` del banco applicativo lo verifica a ogni
esecuzione, quindi questo non è un documento che invecchia in silenzio.

## Una sola porta

In tutta l'app esiste **un solo punto** che apre una transazione di
scrittura su IndexedDB: `repo.scrivi()` in `repo.js`. Nessun service,
nessuna vista, nessun repository specifico apre transazioni per conto
proprio: usano tutti quella funzione.

Verifica: `grep -rn "transaction(" js/` restituisce solo `repo.js`.
`grep -rn "objectStore(" js/` fuori da `repo.js` e `db.js` non
restituisce niente.

## Come si innesta la coda

Quando la modalità condivisa è attiva, `scrittureCondivise.js`
**sostituisce** `repo.scrivi` con una versione che:

1. legge lo stato dei record toccati **prima** della transazione, per
   sapere su quale revisione l'utente sta lavorando;
2. esegue la transazione originale, intercettando `put` ed `elimina`;
3. scrive le voci di coda **dentro la stessa transazione**.

Dato e coda vivono o muoiono insieme: non esiste uno stato in cui il
record è cambiato ma l'operazione non è in coda, né il contrario.

## Le quattro eccezioni dichiarate

Sono le uniche scritture che saltano la coda, ed è giusto che lo facciano.
Usano tutte `repo.scriviSenzaCoda`, che esiste **solo** mentre la modalità
condivisa è attiva ed è raggiungibile da tre file.

### 1. Download dal remoto — `sincronizzazione.js`

Quando arrivano i dati degli altri amministratori vanno scritti in
locale. Rimandarli indietro sarebbe un'eco infinita.

### 2. Aggiornamento della revisione — `sincronizzazione.js`

Quando il remoto accetta una scrittura, il record locale registra la
revisione raggiunta. È un dato tecnico che viene dal remoto, non una
modifica dell'utente.

### 3. Bootstrap iniziale — `bootstrap.js` (tramite il motore)

Il primo caricamento dell'archivio pubblica i dati esistenti con un
protocollo suo, che assegna le revisioni iniziali e inizializza i
contatori. Non passa dalla coda perché non è una modifica: è la nascita
dell'archivio.

### 4. Sostituzione controllata dell'archivio — `modalita.js`

Quando un telefono con dati propri sceglie di adottare l'archivio della
squadra, i suoi store sincronizzati vengono svuotati e riscaricati. La
coda viene svuotata di proposito: **niente di quel telefono deve partire
verso la squadra**. Prima di toccare qualsiasi cosa viene creato un
backup locale.

## Migrazioni dello schema

`db.js` scrive durante l'aggiornamento di versione del database, prima
che l'app sia utilizzabile e prima che qualsiasi modalità sia attiva.
Non c'è coda da riempire perché non c'è ancora un motore.

## Il seed dei dati dimostrativi

`datiDemo.js` e `gennaio2026.js` scrivono attraverso `repo.scrivi`
normale. In modalità locale non esiste coda. In modalità condivisa il
seed **non parte affatto**: `app.js` scarica l'archivio invece di
generare dati. Verificato da `INT21`.

## Cosa succede se qualcuno aggiunge una scorciatoia

`RC28` cerca `scriviSenzaCoda` in tutti i file dell'applicazione ed
elenca i colpevoli. Sono ammessi solo `sincronizzazione.js`,
`modalita.js` e `scrittureCondivise.js`. Un file nuovo che la usasse
farebbe fallire il banco.

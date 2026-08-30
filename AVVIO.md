# Adrenalina — Fasi 1, 2, 3 e 4

Gestionale offline per la squadra di caccia al cinghiale "Adrenalina".
HTML + CSS + JavaScript vanilla. Dati in IndexedDB, sul dispositivo.
Nessun account, nessun servizio online, nessuna connessione a Internet.
Serve però un piccolo server statico locale per aprire l'app: vedi sotto il perché.

## Avvio sul PC

L'app **non va aperta con un doppio clic** su `index.html`: su `file://` il browser
blocca IndexedDB e l'app non ha dove salvare i dati. Serve un server statico locale
(che non usa Internet: gira sul computer stesso).

Dalla cartella che contiene `index.html`:

    python3 -m http.server 8080

Poi apri nel browser:

    http://localhost:8080

Su Windows senza Python va bene anche, da una cartella con Node installato:

    npx serve -l 8080

Per fermare il server: `Ctrl + C`.

## Avvio su smartphone Android

1. Avvia il server sul PC come sopra.
2. Collega telefono e PC alla **stessa rete Wi-Fi** (non serve che il router abbia Internet).
3. Trova l'indirizzo locale del PC:
   - Linux/macOS: `hostname -I` oppure `ipconfig getifaddr en0`
   - Windows: `ipconfig` → voce "Indirizzo IPv4"
4. Sul telefono apri Chrome e vai a `http://192.168.x.x:8080` (l'indirizzo trovato al punto 3).

I dati restano sul telefono, in IndexedDB, e sopravvivono alla chiusura del browser.
Attenzione: cancellare i dati di navigazione di Chrome cancella anche il database.
Prima di farlo, esporta un backup da **Backup dati → Esporta dati**.

## Struttura

    index.html            ordine di caricamento degli script
    css/                  base, layout, componenti
    js/config/            versione, costanti (ruoli, livelli, stati)
    js/data/              accesso a IndexedDB (schema, db, repository)
    js/core/              logica applicativa (id, quote, squadra, stagione, membro, backup)
    js/ui/                interfaccia (router, componenti, viste)
    js/seed/              dati demo

Le dipendenze vanno in una sola direzione: `ui/` → `core/` → `data/`.
Le viste non toccano mai IndexedDB. Per collegare in futuro un backend si sostituisce
`js/data/` con un client HTTP che espone le stesse firme, senza toccare `core/` e `ui/`.

## Primo avvio e ripartenza

Al primo avvio con database vuoto vengono inseriti i dati demo.
Se invece non esiste nessuna squadra (per esempio subito dopo aver eliminato
i dati di prova), l'app apre da sola la **Configurazione iniziale**: nome squadra,
nome stagione, date e quota predefinita. Alla conferma crea squadra e stagione
reali in una sola transazione e torna alla Home. La schermata Backup resta
sempre raggiungibile, cosi' e' possibile ripartire anche da un backup.

## Giornate e presenze

Le giornate appartengono sempre a una squadra e a una stagione: cambiare la
stagione attiva non sposta e non cancella nulla, e la schermata Giornate mostra
per default solo la stagione attiva.

**Regola delle presenze (opzione B del brief).** Lo stato NON_SEGNATO non viene
mai memorizzato: l'assenza di un record `presenze` per la coppia giornata+socio
*significa* NON_SEGNATO. Riportare un socio a "Non segnato" cancella il suo
record. Cosi' una giornata appena creata non genera decine di righe inutili.
La stessa regola vale ovunque: validazione del backup compresa, che rifiuta
qualsiasi record con stato NON_SEGNATO.

Nel database si salvano i codici semantici (`PRESENTE`, `ASSENTE`, `LAVORO`),
mai le sigle X/A/L dei registri cartacei.

**Chi compare nella schermata presenze.** Solo i soci della squadra che hanno
un'iscrizione alla stagione *di quella giornata* e sono attivi, piu' chiunque
abbia gia' una presenza registrata su quella giornata anche se nel frattempo
disattivato. Un socio entrato nel 2027/2028 non compare nelle giornate del
2026/2027, e non gli si puo' registrare una presenza. Un socio disattivato non
perde le presenze gia' registrate e continua a comparire con il suo nome.

Ogni tocco salva subito. Mentre il salvataggio e' in corso restano bloccati
solo i quattro pulsanti di quel socio: il resto della schermata continua a
funzionare, e due tocchi rapidi non producono due scritture sullo stesso record.

## Dati demo

Al primo avvio, se il database è vuoto, vengono inseriti 1 squadra, 1 stagione,
6 soci (di cui uno inattivo e uno con due ruoli), 5 giornate con presenze miste
5 capi nel registro (di cui uno annullato) e 3 controlli sanitari. Tutti i record demo hanno `demo: true`
e si eliminano da **Backup dati → Elimina dati di prova**.
L'operazione si blocca da sola se lascerebbe dati reali senza riferimenti.

## Registro capi

Ogni capo appartiene sempre a una giornata, e da quella giornata derivano
squadra e stagione: la zona non viene duplicata nel record, si legge dalla
giornata.

**Codice capo.** Progressivo leggibile `CG-001`, `CG-002`, univoco dentro la
stagione e garantito da un indice unico sul database. Non e' la chiave primaria:
l'id tecnico resta opaco (`abb_...`). Il numero successivo si calcola dal codice
piu' alto gia' presente, non dal conteggio, cosi' un capo annullato non libera
il suo numero. In una stagione nuova la numerazione riparte da CG-001.

**Peso.** Sempre un intero in grammi: 85,5 kg si memorizza come 85500. La UI
accetta `45`, `45,5` e `45.5` e mostra i kg in formato italiano. Sono rifiutati
peso nullo o negativo e, come semplice protezione tecnica contro gli errori di
battitura, i valori oltre 500 kg.

**Tiratore.** Deve essere della squadra e iscritto alla stagione della giornata:
altrimenti il salvataggio e' bloccato. Se invece risulta ASSENTE o in LAVORO in
quella giornata compare un avviso, ma il salvataggio resta possibile: potrebbe
essere sbagliata la presenza, non l'abbattimento.

**Nessuna cancellazione.** Un capo inserito per errore si modifica oppure si
marca `annullato`. Resta in archivio con il suo codice, non viene conteggiato,
ed e' riconoscibile anche senza colore: bordo tratteggiato, codice barrato e
dicitura "Annullato". Si puo' ripristinare in qualsiasi momento.

## Controllo sanitario (trichinella)

Il controllo e' collegato al singolo capo, non alla giornata, e ogni capo ne ha
al massimo uno: un indice unico su `abbattimentoId` lo garantisce a livello di
database. Salvando si aggiorna il record esistente, non se ne crea un secondo.

Stati: Non prelevato, In attesa, Negativo / Conforme, Positivo, Non valutabile.
Un capo senza record risulta **Non registrato**, che non e' uno stato
memorizzato ma l'assenza del controllo.

Date facoltative: se entrambe presenti, la data di esito non puo' precedere
quella di prelievo, e ciascuna deve esistere davvero sul calendario.

Un capo annullato conserva il suo controllo: resta consultabile e modificabile,
con un avviso nel form. Annullare o ripristinare un capo non tocca mai il
controllo sanitario.

Nel registro capi lo stato compare in ogni card, cosi' si legge senza aprire il
capo. Il POSITIVO non si affida al solo colore: porta un simbolo di attenzione e
il testo in maiuscolo.

## Date

Le date sono sempre `AAAA-MM-GG` e vengono calcolate nel fuso orario locale del
dispositivo (`js/core/calendario.js`), non in UTC: altrimenti in Italia, dopo le
22, "oggi" diventerebbe il giorno successivo. La stessa funzione verifica che la
data esista davvero sul calendario, quindi 2026-02-31 o 2026-13-10 vengono
rifiutate sia nel form sia nel controllo del backup.

## Backup

**Esporta dati** produce un JSON con `schemaVersion: 4` e tutti gli store.
I backup piu' vecchi restano importabili e attraversano la catena di migrazioni:
1→2 aggiunge `giornate` e `presenze`, 2→3 aggiunge `abbattimenti`, 3→4 aggiunge
`controlliSanitari`, tutti come liste vuote. Nessuno store precedente viene
toccato, e `meta.schemaVersion` viene allineato.
**Importa dati** sostituisce integralmente il contenuto, previa conferma esplicita.
Non è una fusione: è una sostituzione.

Prima di toccare il database il file viene controllato due volte: involucro
(formato, `schemaVersion`, presenza di tutti gli store obbligatori) e struttura
(campi obbligatori, importi interi in centesimi, ruoli riconosciuti, e tutti i
riferimenti fra squadre, stagioni, soci e iscrizioni). Se qualcosa non torna
l'importazione si ferma e i dati esistenti restano come sono.

## Test automatici

I test girano con Node e non fanno parte dell'app: `index.html` non carica mai
nulla dalla cartella `test/`.

    npm i jsdom fake-indexeddb
    node test/esegui.js

Coprono modello dati, quote, ID, soci, stagioni, giornate, presenze, registro
capi, controlli sanitari, migrazioni di database e di backup, persistenza,
backup e dati demo.
Il layout va invece controllato a occhio in un browser vero (vedi sotto).

## Controllo del layout

    Chrome → F12 → icona telefono/tablet (Toggle device toolbar)
    provare le larghezze 360, 412 e 430 px, poi la finestra intera

Le schermate da guardare: Home, elenco soci, scheda socio, modifica socio,
Giornate, scheda giornata, form giornata, **Presenze** (la piu' delicata:
quattro controlli affiancati su schermo stretto), Registro abbattimenti, scheda
capo, form capo, form controllo sanitario, Stagioni con il modulo aperto, Backup.

# Scritture che non passano dalla coda

In modalità condivisa **ogni scrittura dell'app** deve finire anche nella
coda di sincronizzazione. L'intercettazione avviene in un punto solo
(`scrittureCondivise.js`, che avvolge `App.data.repo.scrivi`), quindi non
esiste modo di dimenticarsene aggiungendo un service nuovo.

Esistono però quattro casi in cui scrivere in coda sarebbe sbagliato.
Per quelli c'è una via diretta, `App.data.repo.scriviSenzaCoda`, che
esiste **solo mentre la modalità condivisa è attiva** e viene rimossa
all'uscita. Sono queste, e nessun'altra.

Il test `RC28` fallisce se un file diverso da quelli elencati qui sotto
la usa.

---

## 1. Riversamento di ciò che arriva dal remoto

**Dove:** `sincronizzazione.js`, funzione `scarica()`

Quando si scaricano i dati degli altri amministratori, questi vanno
scritti in locale. Se passassero dalla coda, il telefono rimanderebbe
indietro ciò che ha appena ricevuto, all'infinito.

## 2. Aggiornamento della coda stessa e del registro

**Dove:** `sincronizzazione.js`, funzioni `scriviCoda`, `registra`,
`segnaRevisioneLocale`

Segnare che un'operazione è stata inviata, scrivere nel registro, o
annotare sul record locale la revisione ottenuta dal remoto: sono
informazioni di questo dispositivo. Metterle in coda vorrebbe dire
sincronizzare la propria coda, che non ha senso.

## 3. Sostituzione controllata dell'archivio locale

**Dove:** `modalita.js`, funzione `sostituisciConArchivioCondiviso()`

Quando un telefono con dati propri sceglie di adottare l'archivio della
squadra, i suoi dati locali vengono svuotati e sostituiti con quelli
remoti. Quello svuotamento **non deve** generare cancellazioni verso gli
altri: sono dati che non sono mai stati della squadra.

Prima di procedere viene creato un backup locale completo, e l'operazione
parte solo su scelta esplicita dell'amministratore.

## 4. Annotazione dell'archivio di appartenenza

**Dove:** `modalita.js`, subito dopo la sostituzione

Si scrive in `meta` a quale archivio condiviso appartiene ora il
telefono. `meta` è comunque locale e non viaggia mai.

## 5. Normalizzazione degli identificativi prima del bootstrap

**Dove:** `bootstrap.js`, funzione `normalizzaArchivioLocale()`

Un archivio nato in locale ha identificativi casuali. Prima di
pubblicarlo, quelli che devono essere calcolati dai dati vengono
sistemati tutti insieme, aggiornando i riferimenti di chi li cita.

Deve avvenire in una sola transazione e senza passare dalla coda: sono
gli stessi record, non modifiche da propagare. Se passasse dalla coda,
ogni rinomina genererebbe una cancellazione e una scrittura verso una
squadra che non ha ancora nessun archivio.

Succede una volta sola, prima che l'archivio esista.

## 6. Memoria del ruolo verificato

**Dove:** `accessoService.js`, funzione `memorizzaRuolo()`

Dopo ogni verifica riuscita si annota in `meta` quale ruolo ha questo
account. Serve all'avvio senza campo: senza quella memoria un
amministratore autorizzato resterebbe fuori solo perché il telefono non
ha rete.

`meta` è locale per definizione e non viaggia mai.

---

## Bootstrap

Il **caricamento** dei dati verso il remoto non usa la via diretta: passa
dalla coda come qualsiasi altra scrittura, così valgono le stesse regole
di sempre. L'unica parte diretta è la normalizzazione descritta sopra,
che avviene prima e resta locale.

## Migrazioni dello schema

Avvengono in `db.js`, dentro l'evento di aggiornamento di IndexedDB,
prima che l'app sia utilizzabile e prima che la modalità condivisa possa
essere attiva. Non toccano `repo.scrivi`.

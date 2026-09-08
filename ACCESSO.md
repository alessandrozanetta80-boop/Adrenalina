# Accesso e archivio condiviso

Questo file è un riepilogo. Le istruzioni operative complete stanno in
**`FIREBASE-ATTIVAZIONE.md`**: se devi accendere Firebase, apri quello.

## Come funziona l'app oggi (versione 0.8.0)

**Senza Firebase configurato** l'app funziona in locale, come ha sempre
fatto: nessun login, nessuna rete, i dati sul telefono. Al primo avvio
crea i dati dimostrativi.

**Con Firebase configurato** l'app chiede l'accesso con Google. Entrano
solo le persone che hanno un documento in `/accessi`: chiunque
altro, anche dopo essersi autenticato, vede «Accesso non consentito» e
nessun dato.

Da quel momento i dati **si sincronizzano** fra i telefoni degli
amministratori. L'app continua a funzionare senza campo: le modifiche
restano in coda e partono da sole quando torna la linea.

## Chi decide chi entra, e con quale ruolo

Non un elenco nel codice: il database. La voce `/accessi/{identificativo}`
dice se entri e cosa puoi fare.

**Amministratore** — vede e modifica tutto, gestisce gli accessi.
**Sola lettura** — vede tutto, non modifica niente.
**Nessun accesso** — non entra e non legge nulla.

I primi tre amministratori si creano una volta dalla Console Firebase.
**Da lì in poi gli accessi si gestiscono dall'app**: Home → Gestione
accessi. Chi non è autorizzato può premere «Richiedi accesso» dalla
schermata di blocco; un amministratore lo autorizza o rifiuta.

Nessuno può modificare il proprio accesso: né promuoversi, né revocarsi.
Serve un altro amministratore.

Le regole in `firestore.rules` sono l'unica cosa che protegge davvero i
dati. Non il repository privato, non la chiave nell'app.

## Il primo archivio va inizializzato una volta

Finché l'archivio condiviso non è stato inizializzato, i telefoni
lavorano in locale e **non inviano niente**. Un amministratore sceglie il
telefono che contiene l'archivio buono e lo pubblica una volta sola.

Prima di caricare qualsiasi cosa l'app salva un backup completo sul
telefono. Se il file non si riesce a scrivere, l'operazione non parte.

Dettagli in **`MIGRAZIONE-INIZIALE.md`**.

## Un telefono che ha già dati propri

Se colleghi un telefono che ha lavorato in locale a un archivio già
inizializzato, l'app **si ferma** e dice che quel telefono contiene un
archivio diverso da quello della squadra. Non mescola niente in nessuna
delle due direzioni.

Per proseguire devi scegliere esplicitamente «Usa archivio condiviso»,
che salva un backup e poi sostituisce i dati locali con quelli della
squadra.

## Se due modificano la stessa cosa

Sulle presenze vince l'ultima modifica: è un dato semplice da correggere.

Su carne, vendite, ritiri e capi no: se qualcun altro ha già modificato
il record, la tua modifica resta **bloccata** e ti viene mostrato perché.
Non esiste un comando per rimandarla così com'è — riscriverebbe anche i
campi che l'altro ha cambiato. Puoi scartarla, oppure aprire il dato
aggiornato e rifarla.

## Backup

L'esportazione funziona sempre. Il ripristino completo funziona solo in
modalità locale: con l'archivio condiviso attivo viene rifiutato, perché
svuoterebbe il telefono senza dirlo agli altri.

## Dove guardare lo stato

Backup dati → **Sincronizzazione**: modalità, collegamento, ultima
sincronizzazione, modifiche in attesa, conflitti da risolvere.

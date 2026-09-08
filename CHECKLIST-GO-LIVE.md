# Checklist go-live — Adrenalina 0.8.0

Da usare insieme, spuntando man mano. Se un punto non torna, fermarsi
lì: nessuno dei passaggi successivi ha senso senza il precedente.

---

## Prima di toccare Firebase

- [ ] L'app funziona sul telefono, in locale, senza errori
- [ ] I 21 soci sono giusti
- [ ] Il calendario battute è quello vero della stagione
- [ ] **Backup dati → Esporta** eseguito e file salvato fuori dal telefono
- [ ] È stato deciso **quale telefono è il master** (quello con i dati buoni)
- [ ] I tre amministratori hanno un account Google e sono raggiungibili

## Configurazione Firebase (`FIREBASE-ATTIVAZIONE.md`)

- [ ] Progetto creato, Analytics disattivato
- [ ] Authentication → Google attivo
- [ ] Dominio `alessandrozanetta80-boop.github.io` autorizzato
- [ ] Firestore creato in **eur3 (europe-west)**
- [ ] Quattro valori copiati in `firebase.js` e caricati su GitHub
- [ ] `firestore.rules` incollate e **pubblicate**

## Verifica che le regole siano attive

- [ ] Finestra anonima → l'app chiede l'accesso
- [ ] Account non abilitato → **«Accesso non consentito»**, nessun dato visibile
- [ ] Se invece si vedono i dati: **le regole non sono pubblicate, fermarsi**

## Amministratori

- [ ] Alessandro ha provato ad accedere ed è comparso in Authentication → Users
- [ ] Stefano idem
- [ ] Luca idem
- [ ] Tre documenti creati in `accessi` con lo **UID** come nome documento
- [ ] Ogni documento ha `uid`, `email`, `ruolo: AMMINISTRATORE`,
      `creatoDa`, `creatoIl`, `modificatoDa`, `modificatoIl`
- [ ] `ruolo` scritto in maiuscolo, esattamente `AMMINISTRATORE`
- [ ] Tutti e tre riescono a entrare
- [ ] Un quarto account viene respinto

## Inizializzazione dell'archivio

- [ ] Si fa **solo dal telefono master**
- [ ] Backup esportato poco prima
- [ ] Premuto **Inizializza archivio condiviso**
- [ ] L'operazione è arrivata in fondo senza errori
- [ ] Conteggi riportati coerenti con quello che c'era
- [ ] Sulla console Firebase si vedono le raccolte popolate
- [ ] Premendolo una seconda volta: **rifiutato**

## Secondo e terzo telefono

- [ ] Telefono B (mai usato prima) → accede → scarica l'archivio
- [ ] B vede gli stessi soci, giornate e capi di A
- [ ] Nessun dato dimostrativo comparso dal nulla su B
- [ ] Telefono C: stessa cosa

## Prova sul campo

- [ ] A segna un partecipante → **B lo vede**
- [ ] B modifica una giornata → **A la vede**
- [ ] A in modalità aereo segna due partecipanti → restano
- [ ] In Sincronizzazione: «in attesa di partire: 2»
- [ ] Tolta la modalità aereo → partono da sole → B le vede
- [ ] A e B modificano insieme la stessa carne → uno dei due vede un
      conflitto, **nessun dato sparisce**
- [ ] Due capi registrati insieme → codici diversi, mai lo stesso

## Revoca

- [ ] Cancellato il documento di un amministratore
- [ ] Al riavvio quel telefono dice **«Accesso non consentito»**
- [ ] I suoi dati locali sono ancora lì
- [ ] Rimesso il documento → rientra

## Prima di dirlo alla squadra

- [ ] Backup esportato dopo l'inizializzazione
- [ ] I tre amministratori sanno che il ripristino di un backup è bloccato
      in modalità condivisa
- [ ] È chiaro a tutti che **per registrare un capo serve il collegamento**
      (il codice lo assegna la squadra)
- [ ] È stato deciso se e quando cancellare i dati dimostrativi

---

## Cosa non è ancora stato provato da nessuno

Queste cose non sono verificabili senza Firebase vero e due telefoni:
sono esattamente i punti da spuntare sopra. Finché non lo sono, l'archivio
condiviso è da considerare **non collaudato**.

## Conflitti

Se due amministratori modificano lo stesso dato, la seconda modifica
resta bloccata e viene mostrato il motivo. Non esiste un comando per
rimandarla così com'è: riscriverebbe anche i campi che l'altro ha
cambiato.

Si sceglie fra **Apri dato aggiornato** (si rifà la modifica sulla
versione vera) e **Scarta mia modifica**.

## Accessi

I primi tre amministratori si creano una volta dalla Console Firebase.
Dopo, tutto si gestisce dall'app: Home → Gestione accessi.

Chi non è autorizzato può premere «Richiedi accesso»; un amministratore
lo autorizza in sola lettura o come amministratore, oppure rifiuta.

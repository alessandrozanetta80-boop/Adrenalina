# L'inizializzazione dell'archivio condiviso

Questo documento spiega cosa succede quando premi **Inizializza archivio
condiviso**, e soprattutto cosa **non** succede.

Si fa **una volta sola**, da **un solo telefono**.

---

## Cosa viene caricato

Tutti i dati della squadra: squadra, stagioni, soci, iscrizioni, giornate,
partecipanti, capi abbattuti, controlli sanitari, calendario battute,
configurazione carne, lotti, quote, vendite e ritiri.

Anche i **dati dimostrativi**, se sono ancora presenti. Non vengono
eliminati né trattati diversamente: diventano parte dell'archivio iniziale
e li potrai cancellare quando vuoi da «Elimina dati di prova», una volta
sola per tutti.

## Cosa NON viene caricato

**Le informazioni di quel telefono** — versione dello schema, squadra
corrente, presenza dei dati di prova. Restano locali: ogni telefono ha le
sue e non hanno senso condivise.

**La coda di sincronizzazione e il registro delle operazioni.** Sono di
quel dispositivo.

## Il backup di sicurezza

Prima di scrivere anche un solo dato viene creato un backup completo
dell'archivio locale. **Se il backup non riesce, l'inizializzazione non
parte.**

## I controlli prima di partire

L'app si ferma **prima di toccare il database** se:

- non sei autenticato o non sei fra gli amministratori;
- Firebase non è configurato;
- manca il collegamento;
- questo telefono non ha dati da caricare;
- **l'archivio condiviso contiene già dati**;
- l'archivio risulta già inizializzato;
- i dati locali non sono coerenti (riferimenti rotti, record orfani,
  codici duplicati).

Nel caso più importante — archivio già pieno — il messaggio è:

> L'archivio condiviso contiene già dati. L'inizializzazione non può
> essere eseguita.

**Non viene fatto nessun merge.** Non ti viene chiesto quale versione
tenere. Non si sovrascrive niente. Se sei in questa situazione vuol dire
che qualcun altro ha già inizializzato, e la strada giusta è collegare
questo telefono a quell'archivio, non crearne un secondo.

## I contatori dei codici capo

I codici `CG-001`, `CG-002`... sono assegnati dal database con una
transazione, così due amministratori non ottengono mai lo stesso numero.

Se in archivio ci sono già capi fino a `CG-017`, il contatore parte da 17
e il primo capo nuovo prende `CG-018`. **Non riparte da uno.** Il conto è
fatto stagione per stagione.

## Le revisioni

Ogni documento caricato riceve la **revisione 1**: è la prima versione
condivisa di quel dato. Da lì in poi ogni modifica la fa avanzare, ed è
quel numero che permette di accorgersi quando due persone toccano la
stessa cosa.

## Il marchio dell'inizializzazione

A operazione conclusa viene scritto un documento tecnico che dice che
l'archivio esiste: versione dell'app, versione dello schema, chi ha fatto
l'inizializzazione, quando, quanti record per ogni tipo, e un
identificativo dell'archivio.

Non si può modificare né cancellare, nemmeno da un amministratore. È
quello che rende l'operazione ripetibile senza danni: se qualcuno preme di
nuovo il pulsante, l'app vede il marchio e si ferma. **Nessun duplicato.**

## La verifica finale

Dopo il caricamento l'app riconta i record sul database e li confronta con
quelli locali, tipo per tipo. Se un numero non torna l'operazione viene
dichiarata fallita, così non ti resta l'impressione che sia andata bene.

## Se un telefono contiene dati diversi

Caso concreto: Stefano ha usato l'app in locale per due settimane, poi
viene configurato Firebase e l'archivio è già stato inizializzato da te.

I dati di Stefano **non vengono caricati sulla squadra** e non vengono
mescolati: verrebbero fuori due soci con lo stesso nome, giornate doppie,
capi con codici che si scontrano.

L'app riconosce la situazione e chiede una scelta esplicita: **«Usa
archivio condiviso»**. Da lì: viene creato un backup locale, i dati
sincronizzati del telefono vengono rimossi, si scarica l'archivio della
squadra e il telefono viene marcato come appartenente a quell'archivio.

Il backup resta: se qualcosa di quei dati serviva, si recupera da lì.

## Ripristinare un backup

In modalità condivisa **è bloccato**. Il ripristino svuota e riscrive gli
store, e quello svuotamento non diventerebbe una cancellazione per gli
altri telefoni: quello che hai ripristinato tornerebbe a scontrarsi con
l'archivio della squadra.

L'esportazione invece funziona sempre, e conviene farla ogni tanto.

In modalità locale il ripristino funziona come è sempre funzionato.

(function (global) {
  'use strict';
  var App = global.App;
  App.core = App.core || {};

  // SINCRONIZZAZIONE
  //
  // IndexedDB resta l'archivio di lavoro: l'app funziona offline come
  // sempre. Firestore diventa l'archivio condiviso fra amministratori.
  //
  // Come funziona un cambiamento:
  //   1. si scrive subito in locale (l'app non aspetta la rete);
  //   2. si accoda un'operazione nella outbox, con un operationId unico;
  //   3. quando c'e' rete la outbox viene svuotata verso il remoto;
  //   4. il remoto scarta le operazioni gia' viste (stesso operationId),
  //      quindi un tentativo ripetuto non duplica niente.
  //
  // Due politiche diverse sui conflitti, perche' i dati non sono uguali:
  //
  //   PRESENZE -> vince l'ultima modifica. Segnare presente qualcuno e'
  //   un'informazione semplice: se due la toccano, l'ultima e' quella
  //   giusta. Resta traccia nel registro di chi e quando.
  //
  //   CARNE, VENDITE, RITIRI, QUOTE, LOTTI -> nessuna sovrascrittura.
  //   Ogni record porta un numero di revisione; chi modifica dichiara
  //   quale revisione ha visto. Se nel frattempo e' cambiata, l'operazione
  //   viene RIFIUTATA con esito CONFLITTO e i dati non vengono toccati.
  //   Su chili e soldi perdere una modifica in silenzio non e' accettabile.

  var ESITO = {
    OK: 'OK',
    CONFLITTO: 'CONFLITTO',
    NEGATO: 'NEGATO',
    DUPLICATA: 'DUPLICATA',
    ERRORE: 'ERRORE'
  };

  var STATO_OP = { IN_ATTESA: 'IN_ATTESA', INVIATA: 'INVIATA', BLOCCATA: 'BLOCCATA' };

  // Store su cui un conflitto va segnalato invece che sovrascritto.
  var STORE_PROTETTI = ['lottiCarne', 'quoteCarne', 'venditeCarne',
    'ritiriCarne', 'configCarne', 'abbattimenti', 'iscrizioni'];

  // Store su cui vince l'ultima modifica.
  var STORE_ULTIMA_VINCE = ['presenze', 'giornate', 'membri', 'squadre',
    'stagioni', 'calendariBattuta', 'controlliSanitari', 'meta'];

  function protetto(store) { return STORE_PROTETTI.indexOf(store) !== -1; }

  function uuid() { return App.core.id.uuid(); }

  function adesso() { return new Date().toISOString(); }

  // ---------------------------------------------------------------- motore
  // locale: oggetto con leggiStore/scrivi (di norma App.data.repo)
  // remoto: adattatore con applica(operazioni) e leggiTutto(dopo)
  // utente: { uid, email } di chi sta lavorando
  function crea(opzioni) {
    var locale = opzioni.locale;
    var remoto = opzioni.remoto || null;
    var utente = opzioni.utente || { uid: 'locale', email: '' };
    var inCorso = false;

    function registra(voce) {
      return locale.scrivi(['audit'], function (t) {
        t.put('audit', {
          id: uuid(),
          operationId: voce.operationId,
          quando: adesso(),
          chi: utente.email || utente.uid,
          store: voce.store,
          recordId: voce.recordId,
          tipo: voce.tipo,
          esito: voce.esito,
          dettaglio: voce.dettaglio || ''
        });
      });
    }

    // Accoda una modifica. Scrive prima in locale, poi mette in coda.
    // expectedRevision: la revisione che chi modifica ha visto. Serve
    // solo sugli store protetti.
    function accoda(op) {
      if (!op || !op.store || !op.tipo) {
        return Promise.reject(new Error('Operazione incompleta.'));
      }
      var operationId = op.operationId || uuid();
      var record = op.dati || null;

      // Identificativo calcolato dove l'unicita' lo richiede.
      var recordId = op.recordId ||
        (record && App.core.idDeterministici.deterministico(op.store)
          ? App.core.idDeterministici.calcola(op.store, record)
          : (record && record.id));
      if (!recordId) return Promise.reject(new Error('Record senza identificativo.'));

      var voce = {
        operationId: operationId,
        tipo: op.tipo,                 // 'put' | 'delete'
        store: op.store,
        recordId: recordId,
        dati: record ? JSON.parse(JSON.stringify(record)) : null,
        expectedRevision: protetto(op.store)
          ? (op.expectedRevision === undefined ? null : op.expectedRevision)
          : null,
        chi: utente.uid,
        creataIl: adesso(),
        stato: STATO_OP.IN_ATTESA,
        tentativi: 0,
        esito: null,
        dettaglio: ''
      };
      if (voce.dati) voce.dati.id = recordId;

      // Un record scritto prima della sincronizzazione ha un
      // identificativo casuale. Passando a quello calcolato va rimosso
      // il vecchio, altrimenti restano due record per la stessa cosa
      // (e l'indice unico del database locale lo rifiuta).
      var pulisci = App.core.idDeterministici.deterministico(op.store)
        ? locale.leggiStore([op.store]).then(function (d) {
            return d[op.store].filter(function (r) {
              return r.id !== recordId &&
                App.core.idDeterministici.calcola(op.store, r) === recordId;
            }).map(function (r) { return r.id; });
          })
        : Promise.resolve([]);

      return pulisci.then(function (daTogliere) {
        return locale.scrivi([op.store, 'outbox'], function (t) {
          daTogliere.forEach(function (id) { t.elimina(op.store, id); });
          if (op.tipo === 'delete') t.elimina(op.store, recordId);
          else t.put(op.store, voce.dati);
          t.put('outbox', voce);
          return voce;
        });
      });
    }

    function inAttesa() {
      return locale.leggiStore(['outbox']).then(function (d) {
        return d.outbox
          .filter(function (o) { return o.stato === STATO_OP.IN_ATTESA; })
          .sort(function (a, b) { return String(a.creataIl).localeCompare(b.creataIl); });
      });
    }

    function bloccate() {
      return locale.leggiStore(['outbox']).then(function (d) {
        return d.outbox.filter(function (o) { return o.stato === STATO_OP.BLOCCATA; });
      });
    }

    // Invio della coda. Le operazioni partono in ordine; una bloccata
    // per conflitto non ferma le altre, ma resta in coda perche'
    // qualcuno la guardi.
    function invia() {
      if (!remoto) return Promise.resolve({ inviate: 0, conflitti: 0, negate: 0 });
      return inAttesa().then(function (coda) {
        var esiti = { inviate: 0, conflitti: 0, negate: 0, duplicate: 0, errori: 0 };
        var catena = Promise.resolve();
        coda.forEach(function (voce) {
          catena = catena.then(function () {
            return remoto.applica(voce, utente).then(function (r) {
              voce.tentativi++;
              voce.esito = r.esito;
              voce.dettaglio = r.dettaglio || '';
              if (r.esito === ESITO.OK || r.esito === ESITO.DUPLICATA) {
                voce.stato = STATO_OP.INVIATA;
                if (r.esito === ESITO.OK) esiti.inviate++;
                else esiti.duplicate++;
              } else if (r.esito === ESITO.CONFLITTO) {
                voce.stato = STATO_OP.BLOCCATA;
                esiti.conflitti++;
              } else if (r.esito === ESITO.NEGATO) {
                voce.stato = STATO_OP.BLOCCATA;
                esiti.negate++;
              } else {
                // errore di rete: resta in attesa, si ritentera'
                esiti.errori++;
              }
              return locale.scrivi(['outbox'], function (t) {
                t.put('outbox', voce);
              }).then(function () {
                return registra({
                  operationId: voce.operationId, store: voce.store,
                  recordId: voce.recordId, tipo: voce.tipo,
                  esito: voce.esito, dettaglio: voce.dettaglio
                });
              });
            }).catch(function (e) {
              // Nessuna risposta: l'operazione resta in coda intatta.
              voce.tentativi++;
              esiti.errori++;
              void e;
              return locale.scrivi(['outbox'], function (t) { t.put('outbox', voce); });
            });
          });
        });
        return catena.then(function () { return esiti; });
      });
    }

    // Scarica dal remoto e riversa in locale.
    function scarica() {
      if (!remoto || !remoto.leggiTutto) return Promise.resolve({ ricevuti: 0 });
      return remoto.leggiTutto(utente).then(function (dati) {
        var store = Object.keys(dati);
        if (!store.length) return { ricevuti: 0 };
        var n = 0;
        return locale.scrivi(store, function (t) {
          store.forEach(function (nome) {
            dati[nome].forEach(function (rec) { t.put(nome, rec); n++; });
          });
        }).then(function () { return { ricevuti: n }; });
      });
    }

    function sincronizza() {
      if (inCorso) return Promise.resolve({ saltata: true });
      inCorso = true;
      return invia()
        .then(function (esiti) {
          return scarica().then(function (s) {
            return { invio: esiti, ricezione: s };
          });
        })
        .then(function (r) { inCorso = false; return r; })
        .catch(function (e) { inCorso = false; throw e; });
    }

    // Codice capo: mai "leggi il massimo e aggiungi uno".
    // Il numero lo assegna il remoto con una transazione: due
    // amministratori contemporanei ottengono due numeri diversi.
    function allocaCodiceCapo(stagioneId) {
      if (!remoto || !remoto.prossimoCodiceCapo) {
        return Promise.reject(new Error(
          'Numerazione dei capi non disponibile senza collegamento.'));
      }
      return remoto.prossimoCodiceCapo(stagioneId, utente)
        .then(function (n) { return App.core.capo.formattaCodice(n); });
    }

    function stato() {
      return locale.leggiStore(['outbox']).then(function (d) {
        var attesa = 0, bloccate = 0, inviate = 0;
        d.outbox.forEach(function (o) {
          if (o.stato === STATO_OP.IN_ATTESA) attesa++;
          else if (o.stato === STATO_OP.BLOCCATA) bloccate++;
          else inviate++;
        });
        return { inAttesa: attesa, bloccate: bloccate, inviate: inviate,
          collegato: !!remoto };
      });
    }

    function registroAudit() {
      return locale.leggiStore(['audit']).then(function (d) {
        return d.audit.slice().sort(function (a, b) {
          return String(b.quando).localeCompare(a.quando);
        });
      });
    }

    // Una volta risolto a mano un conflitto, l'operazione si ripropone
    // con la revisione aggiornata.
    function riproponi(operationId, expectedRevision) {
      return locale.leggiStore(['outbox']).then(function (d) {
        var voce = d.outbox.filter(function (o) {
          return o.operationId === operationId;
        })[0];
        if (!voce) throw new Error('Operazione non trovata.');
        voce.stato = STATO_OP.IN_ATTESA;
        voce.expectedRevision = expectedRevision;
        voce.esito = null;
        // nuovo identificativo: e' un nuovo tentativo, non un ritento
        voce.operationId = uuid();
        return locale.scrivi(['outbox'], function (t) {
          t.elimina('outbox', operationId);
          t.put('outbox', voce);
          return voce;
        });
      });
    }

    return {
      ESITO: ESITO,
      STATO_OP: STATO_OP,
      accoda: accoda,
      invia: invia,
      scarica: scarica,
      sincronizza: sincronizza,
      allocaCodiceCapo: allocaCodiceCapo,
      stato: stato,
      inAttesa: inAttesa,
      bloccate: bloccate,
      registroAudit: registroAudit,
      riproponi: riproponi,
      protetto: protetto,
      impostaRemoto: function (r) { remoto = r; },
      utente: function () { return utente; }
    };
  }

  App.core.sync = {
    crea: crea,
    ESITO: ESITO,
    STATO_OP: STATO_OP,
    STORE_PROTETTI: STORE_PROTETTI,
    STORE_ULTIMA_VINCE: STORE_ULTIMA_VINCE,
    protetto: protetto
  };
})(typeof window !== 'undefined' ? window : globalThis);

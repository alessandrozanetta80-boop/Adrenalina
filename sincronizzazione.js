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
    'stagioni', 'calendariBattuta', 'controlliSanitari'];

  function protetto(store) { return STORE_PROTETTI.indexOf(store) !== -1; }

  function uuid() { return App.core.id.uuid(); }

  function adesso() { return new Date().toISOString(); }

  // ---------------------------------------------------------------- motore
  // locale: oggetto con leggiStore/scrivi (di norma App.data.repo)
  // remoto: adattatore con applica(operazioni) e leggiTutto(dopo)
  // utente: { uid, email } di chi sta lavorando
  function crea(opzioni) {
    var locale = opzioni.locale;
    // Scrittura che non ripassa dalla coda: serve per i dati ricevuti
    // e per la coda stessa.
    function scriviDiServizio(nomi, fn) {
      var f = locale.scriviSenzaCoda || locale.scrivi;
      return f.call(locale, nomi, fn);
    }

    // Quando il remoto accetta una scrittura, il record locale deve
    // sapere a quale revisione e' arrivato. Altrimenti la modifica
    // successiva partirebbe da una revisione ignota e finirebbe in
    // conflitto contro se stessa al giro dopo.
    function segnaRevisioneLocale(voce, esitoRemoto) {
      if (voce.tipo !== 'put') return Promise.resolve();
      if (typeof esitoRemoto.revision !== 'number') return Promise.resolve();
      return locale.leggiStore([voce.store]).then(function (d) {
        var record = d[voce.store].filter(function (r) {
          return r.id === voce.recordId;
        })[0];
        if (!record || record.revision === esitoRemoto.revision) return undefined;
        record.revision = esitoRemoto.revision;
        return scriviDiServizio([voce.store], function (t) {
          t.put(voce.store, record);
        });
      });
    }
    // L'ordine delle operazioni non puo' dipendere dall'orologio: due
    // modifiche fatte nello stesso millesimo di secondo finirebbero in
    // ordine casuale, e una catena causale andrebbe a pezzi.
    var progressivo = 0;
    var remoto = opzioni.remoto || null;
    var utente = opzioni.utente || { uid: 'locale', email: '' };
    var inCorso = false;
    // Ultima revisione che ABBIAMO ottenuto noi per ogni record. Serve
    // quando due modifiche allo stesso record finiscono in due giri di
    // invio diversi: la seconda parte dalla revisione che ha prodotto la
    // prima, non da quella che aveva letto l'utente.
    // Non nasconde i conflitti veri: se nel frattempo ha scritto un
    // altro, la revisione remota sara' diversa da questa e il confronto
    // dell'adattatore lo rileva comunque.
    var revisioneNostra = {};

    function registra(voce) {
      return scriviDiServizio(['audit'], function (t) {
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
        // Sugli store protetti la revisione va dichiarata sempre,
        // tranne quando si sta creando qualcosa che non esiste ancora.
        expectedRevision: protetto(op.store)
          ? (op.expectedRevision === undefined ? null : op.expectedRevision)
          : null,
        chi: utente.uid,
        creataIl: adesso(),
        sequenza: ++progressivo,
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
        return scriviDiServizio([op.store, 'outbox'], function (t) {
          daTogliere.forEach(function (id) { t.elimina(op.store, id); });
          if (op.tipo === 'delete') t.elimina(op.store, recordId);
          else t.put(op.store, voce.dati);
          t.put('outbox', voce);
          return voce;
        });
      });
    }

    // Costruisce la voce di coda senza scriverla: serve a chi vuole
    // metterla nella propria transazione insieme al dato locale.
    function vocePerCoda(op) {
      var recordId = op.recordId ||
        (op.dati && App.core.idDeterministici.deterministico(op.store)
          ? App.core.idDeterministici.calcola(op.store, op.dati)
          : (op.dati && op.dati.id));
      var voce = {
        operationId: op.operationId || uuid(),
        tipo: op.tipo,
        store: op.store,
        recordId: recordId,
        dati: op.dati ? JSON.parse(JSON.stringify(op.dati)) : null,
        expectedRevision: protetto(op.store)
          ? (op.expectedRevision === undefined ? null : op.expectedRevision)
          : null,
        chi: utente.uid,
        creataIl: adesso(),
        sequenza: ++progressivo,
        stato: STATO_OP.IN_ATTESA,
        tentativi: 0,
        esito: null,
        dettaglio: ''
      };
      if (voce.dati) voce.dati.id = recordId;
      return voce;
    }

    function inAttesa() {
      return locale.leggiStore(['outbox']).then(function (d) {
        return d.outbox
          .filter(function (o) { return o.stato === STATO_OP.IN_ATTESA; })
          .sort(function (a, b) {
            var perTempo = String(a.creataIl).localeCompare(String(b.creataIl));
            if (perTempo !== 0) return perTempo;
            return (a.sequenza || 0) - (b.sequenza || 0);
          });
      });
    }

    function bloccate() {
      return locale.leggiStore(['outbox']).then(function (d) {
        return d.outbox.filter(function (o) { return o.stato === STATO_OP.BLOCCATA; });
      });
    }

    // Invio della coda.
    //
    // CATENA LOCALE
    // Piu' modifiche fatte qui sullo stesso record prima di
    // sincronizzare formano una catena: la seconda dipende dalla prima.
    // Se la prima passa e porta il remoto alla revisione 2, la seconda
    // deve dichiarare 2, non la revisione che aveva visto l'utente.
    // Altrimenti il dispositivo va in conflitto contro se stesso.
    //
    // Questo NON nasconde i conflitti veri: la revisione aggiornata la
    // si accetta solo se arriva da un'operazione nostra andata a buon
    // fine in questa stessa coda. Se il remoto e' avanzato per mano di
    // un altro amministratore, il primo confronto lo rileva, e da quel
    // momento tutta la catena su quel record si ferma: le operazioni
    // successive non vengono nemmeno tentate, cosi' non possono
    // scavalcare il conflitto e sovrascrivere il lavoro altrui.
    function chiave(voce) { return voce.store + '__' + voce.recordId; }

    function invia() {
      if (!remoto) return Promise.resolve({ inviate: 0, conflitti: 0, negate: 0 });
      return inAttesa().then(function (coda) {
        var esiti = { inviate: 0, conflitti: 0, negate: 0, duplicate: 0,
          errori: 0, sospese: 0 };
        var revisioneCatena = revisioneNostra;   // chiave -> revisione raggiunta da noi
        var catenaFerma = {};       // chiave -> conflitto: serve una scelta
        var catenaSospesa = {};     // chiave -> rete assente: si ritentera'
        var catena = Promise.resolve();

        coda.forEach(function (voce, indice) {
          catena = catena.then(function () {
            var k = chiave(voce);

            // Un'operazione precedente della stessa catena e' in
            // conflitto: questa non parte, altrimenti scavalcherebbe il
            // conflitto e sovrascriverebbe il lavoro di un altro.
            if (catenaFerma[k]) {
              voce.stato = STATO_OP.BLOCCATA;
              voce.esito = ESITO.CONFLITTO;
              voce.dettaglio = 'Dipende da una modifica precedente rimasta in conflitto.';
              esiti.sospese++;
              return scriviDiServizio(['outbox'], function (t) { t.put('outbox', voce); });
            }

            // La rete e' caduta su un'operazione precedente dello stesso
            // record: questa resta in coda cosi' com'e', l'ordine va
            // rispettato ma non c'e' niente da risolvere a mano.
            if (catenaSospesa[k]) {
              esiti.errori++;
              return Promise.resolve();
            }

            // Se abbiamo gia' fatto avanzare noi questo record in
            // questa coda, la revisione da dichiarare e' quella.
            if (protetto(voce.store) &&
                Object.prototype.hasOwnProperty.call(revisioneCatena, k)) {
              voce.expectedRevision = revisioneCatena[k];
            }

            return remoto.applica(voce, utente).then(function (r) {
              voce.tentativi++;
              voce.esito = r.esito;
              voce.dettaglio = r.dettaglio || '';

              if (r.esito === ESITO.OK || r.esito === ESITO.DUPLICATA) {
                voce.stato = STATO_OP.INVIATA;
                // La catena avanza solo se il remoto ci ha detto a quale
                // revisione siamo arrivati NOI. Se non lo sa (operazione
                // vecchia, registrata prima di questo campo) la catena
                // si ferma qui: meglio un conflitto da risolvere a mano
                // che una sovrascrittura silenziosa.
                if (typeof r.revision === 'number') revisioneCatena[k] = r.revision;
                else if (protetto(voce.store)) catenaSospesa[k] = true;
                if (r.esito === ESITO.OK) esiti.inviate++;
                else esiti.duplicate++;
              } else if (r.esito === ESITO.CONFLITTO) {
                voce.stato = STATO_OP.BLOCCATA;
                catenaFerma[k] = true;
                delete revisioneNostra[k];   // la nostra idea era sbagliata
                esiti.conflitti++;
              } else if (r.esito === ESITO.NEGATO) {
                voce.stato = STATO_OP.BLOCCATA;
                catenaFerma[k] = true;
                esiti.negate++;
                // Un permesso negato non e' un intoppo qualunque: puo'
                // voler dire che l'accesso e' stato revocato. Si chiede
                // una riverifica invece di continuare a comportarsi da
                // amministratore.
                if (App.core.modalita && App.core.modalita.chiediRiverifica) {
                  App.core.modalita.chiediRiverifica();
                }
              } else {
                // errore di rete: resta in attesa, si ritentera'.
                // La catena si sospende per non mandare fuori ordine le
                // operazioni successive sullo stesso record.
                catenaSospesa[k] = true;
                esiti.errori++;
              }

              return segnaRevisioneLocale(voce, r).then(function () {
                return scriviDiServizio(['outbox'], function (t) {
                  t.put('outbox', voce);
                });
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
              catenaSospesa[k] = true;
              esiti.errori++;
              void e;
              return scriviDiServizio(['outbox'], function (t) { t.put('outbox', voce); });
            });
          });
          void indice;
        });
        return catena.then(function () { return esiti; });
      });
    }

    // Scarica dal remoto e riversa in locale.
    function scarica() {
      if (!remoto || !remoto.leggiTutto) {
        return Promise.resolve({ ricevuti: 0, eliminati: 0 });
      }
      return remoto.leggiTutto(utente).then(function (dati) {
        // Le lapidi dicono cosa e' stato cancellato altrove. Ognuna
        // porta la revisione a cui si riferisce: vale solo se il record
        // vivo non e' piu' recente. Cosi' un record ricreato dopo una
        // cancellazione non viene sepolto di nuovo.
        var lapidi = dati.__eliminati || [];
        delete dati.__eliminati;

        // Cosa e' arrivato di vivo, per confrontare le revisioni.
        var viviPerChiave = {};
        Object.keys(dati).forEach(function (nome) {
          dati[nome].forEach(function (rec) {
            viviPerChiave[nome + '__' + rec.id] = rec;
          });
        });

        var daCancellare = lapidi.filter(function (l) {
          var vivo = viviPerChiave[l.store + '__' + l.recordId];
          if (!vivo) return true;                       // nessun record vivo
          var revVivo = vivo.revision || 0;
          var revLapide = l.revision || 0;
          return revVivo <= revLapide;                  // lapide piu' recente
        });

        var store = Object.keys(dati);
        daCancellare.forEach(function (l) {
          if (store.indexOf(l.store) === -1) store.push(l.store);
        });
        if (!store.length) return { ricevuti: 0, eliminati: 0 };

        var n = 0, tolti = 0;
        return scriviDiServizio(store, function (t) {
          Object.keys(dati).forEach(function (nome) {
            dati[nome].forEach(function (rec) { t.put(nome, rec); n++; });
          });
          // Le cancellazioni si applicano dopo, ma solo quelle ancora valide.
          daCancellare.forEach(function (l) {
            t.elimina(l.store, l.recordId);
            tolti++;
          });
        }).then(function () { return { ricevuti: n, eliminati: tolti }; });
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
    // SCARTARE UN'OPERAZIONE IN CONFLITTO
    //
    // Non esiste una "riproposta" automatica, ed e' una scelta.
    // Rimandare la vecchia fotografia del record cambiando soltanto la
    // revisione attesa vorrebbe dire riscrivere TUTTI i campi sopra la
    // versione dell'altro amministratore, compresi quelli che non si
    // voleva toccare: una forzatura con un nome gentile.
    //
    // Chi ha un conflitto ha due strade oneste:
    //   - scartare la propria modifica;
    //   - riaprire il record aggiornato e rifarla, il che produce una
    //     nuova operazione basata sulla versione vera.
    //
    // L'operazione resta in coda finche' non si sceglie: non si perde.
    function scarta(operationId) {
      return locale.leggiStore(['outbox']).then(function (d) {
        var voce = d.outbox.filter(function (o) {
          return o.operationId === operationId;
        })[0];
        if (!voce) throw new Error('Operazione non trovata.');
        if (voce.stato !== STATO_OP.BLOCCATA) {
          throw new Error('Si possono scartare solo le operazioni in conflitto.');
        }
        return scriviDiServizio(['outbox'], function (t) {
          t.elimina('outbox', operationId);
        }).then(function () {
          return registra({
            operationId: operationId, store: voce.store,
            recordId: voce.recordId, tipo: voce.tipo,
            esito: 'SCARTATA',
            dettaglio: 'Modifica locale scartata dall\u2019amministratore.'
          });
        }).then(function () { return voce; });
      });
    }

    return {
      ESITO: ESITO,
      STATO_OP: STATO_OP,
      accoda: accoda,
      vocePerCoda: vocePerCoda,
      invia: invia,
      scarica: scarica,
      sincronizza: sincronizza,
      allocaCodiceCapo: allocaCodiceCapo,
      stato: stato,
      inAttesa: inAttesa,
      bloccate: bloccate,
      registroAudit: registroAudit,
      scarta: scarta,
      protetto: protetto,
      impostaRemoto: function (r) { remoto = r; },
      adattatore: function () { return remoto; },
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

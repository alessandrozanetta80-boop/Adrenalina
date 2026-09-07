(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  // ADATTATORE FIRESTORE
  //
  // Traduce le operazioni della coda in scritture su Firestore.
  // Tre garanzie, tutte ottenute con transazioni lato server:
  //
  //   1. IDEMPOTENZA — ogni operazione ha un operationId. Prima di
  //      scrivere si guarda se quell'identificativo e' gia' stato
  //      applicato: in tal caso non si fa niente e si risponde
  //      DUPLICATA. Un tentativo ripetuto dopo un timeout non duplica.
  //
  //   2. REVISIONI — sugli store protetti si confronta la revisione
  //      attesa con quella presente. Se differiscono si risponde
  //      CONFLITTO e non si scrive nulla.
  //
  //   3. NUMERAZIONE DEI CAPI — il progressivo si legge e si incrementa
  //      dentro una transazione sul documento del contatore. Due
  //      amministratori contemporanei ottengono numeri diversi.
  //
  // I permessi non li controlla questo file: li applicano le regole del
  // database. Se le regole rifiutano, qui arriva un errore che viene
  // tradotto in NEGATO.

  function creaAdattatore(db, campoServer) {
    var ESITO = App.core.sync.ESITO;

    function docOperazione(operationId) {
      return db.collection('operazioni').doc(operationId);
    }

    function negato(e) {
      var c = e && (e.code || e.message || '');
      return String(c).indexOf('permission-denied') !== -1 ||
             String(c).indexOf('PERMISSION_DENIED') !== -1;
    }

    function applica(voce, utente) {
      var rifDoc = db.collection(voce.store).doc(voce.recordId);
      var rifOp = docOperazione(voce.operationId);

      return db.runTransaction(function (t) {
        return t.get(rifOp).then(function (giaFatta) {
          // 1. gia' applicata: si risponde e non si tocca niente
          if (giaFatta && giaFatta.exists) {
            return { esito: ESITO.DUPLICATA };
          }
          return t.get(rifDoc).then(function (attuale) {
            var revAttuale = (attuale && attuale.exists &&
              attuale.data().revision) || 0;

            // 2. revisione: solo sugli store protetti
            if (App.core.sync.protetto(voce.store)) {
              var attesa = voce.expectedRevision;
              var esisteva = !!(attuale && attuale.exists);
              if (!esisteva && attesa !== null && attesa !== 0) {
                return { esito: ESITO.CONFLITTO,
                  dettaglio: 'Il record non esiste piu\u2019.' };
              }
              if (esisteva && attesa !== null && attesa !== revAttuale) {
                return { esito: ESITO.CONFLITTO,
                  dettaglio: 'Modificato da qualcun altro (revisione ' +
                    revAttuale + ', tu avevi la ' + attesa + ').' };
              }
            }

            if (voce.tipo === 'delete') {
              t.delete(rifDoc);
            } else {
              var dati = JSON.parse(JSON.stringify(voce.dati));
              dati.revision = revAttuale + 1;
              dati.modificatoDa = utente.uid;
              dati.modificatoIl = campoServer ? campoServer() : new Date().toISOString();
              t.set(rifDoc, dati);
            }

            t.set(rifOp, {
              operationId: voce.operationId,
              store: voce.store,
              recordId: voce.recordId,
              tipo: voce.tipo,
              chi: utente.uid,
              quando: campoServer ? campoServer() : new Date().toISOString()
            });
            return { esito: ESITO.OK };
          });
        });
      }).catch(function (e) {
        if (negato(e)) return { esito: ESITO.NEGATO, dettaglio: 'Permesso negato.' };
        return { esito: ESITO.ERRORE, dettaglio: e.message || 'Errore di rete.' };
      });
    }

    // Numerazione atomica: mai calcolata dal client.
    function prossimoCodiceCapo(stagioneId, utente) {
      var rif = db.collection('contatori').doc('capi_' + stagioneId);
      return db.runTransaction(function (t) {
        return t.get(rif).then(function (doc) {
          var ultimo = (doc && doc.exists && doc.data().ultimo) || 0;
          var nuovo = ultimo + 1;
          t.set(rif, { ultimo: nuovo, aggiornatoDa: utente.uid });
          return nuovo;
        });
      });
    }

    function leggiTutto(utente, dopo) {
      var store = App.data.schema.nomiStoreBackup.filter(function (n) {
        return n !== 'meta';
      });
      var risultato = {};
      var catena = Promise.resolve();
      store.forEach(function (nome) {
        catena = catena.then(function () {
          var q = db.collection(nome);
          if (dopo) q = q.where('modificatoIl', '>', dopo);
          return q.get().then(function (snap) {
            risultato[nome] = [];
            snap.forEach(function (d) { risultato[nome].push(d.data()); });
          }).catch(function () { risultato[nome] = []; });
        });
      });
      void utente;
      return catena.then(function () { return risultato; });
    }

    return {
      applica: applica,
      prossimoCodiceCapo: prossimoCodiceCapo,
      leggiTutto: leggiTutto
    };
  }

  App.data.adattatoreFirestore = { crea: creaAdattatore };
})(typeof window !== 'undefined' ? window : globalThis);

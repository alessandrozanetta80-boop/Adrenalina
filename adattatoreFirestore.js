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

    // Il momento lo decide il server, non l'orologio del telefono:
    // due dispositivi con l'ora sbagliata non devono poter alterare
    // l'ordine degli eventi.
    function quando() {
      if (campoServer) return campoServer();
      var fb = global.firebase;
      if (fb && fb.firestore && fb.firestore.FieldValue &&
          fb.firestore.FieldValue.serverTimestamp) {
        return fb.firestore.FieldValue.serverTimestamp();
      }
      return new Date().toISOString();
    }

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
          var rifLapide = db.collection('eliminati')
            .doc(voce.store + '__' + voce.recordId);
          return t.get(rifDoc).then(function (attuale) {
            return t.get(rifLapide).then(function (lapide) {
            // La numerazione delle revisioni non riparte mai da capo:
            // se il record e' stato cancellato, riprende dalla lapide.
            // Altrimenti un record ricreato avrebbe revisione 1 e la
            // vecchia lapide continuerebbe a seppellirlo.
            var revLapide = (lapide && lapide.exists && lapide.data().revision) || 0;
            var revDoc = (attuale && attuale.exists && attuale.data().revision) || 0;
            var revAttuale = Math.max(revDoc, revLapide);

            // 1. gia' applicata: si risponde senza toccare niente.
            //    La revisione restituita e' quella che QUESTA operazione
            //    aveva prodotto allora, non quella attuale del record.
            //    Se nel frattempo un altro amministratore ha scritto,
            //    la revisione corrente e' sua: prenderla per nostra
            //    farebbe scavalcare il suo lavoro senza accorgersene.
            if (giaFatta && giaFatta.exists) {
              var dati = giaFatta.data() || {};
              return { esito: ESITO.DUPLICATA, revision: dati.revisionApplicata };
            }

            // 2. revisione: sugli store protetti non esistono
            //    lasciapassare. Creare vuol dire che il documento non
            //    c'e'; modificare o cancellare richiede di dichiarare
            //    quale revisione si e' vista, e deve coincidere.
            if (App.core.sync.protetto(voce.store)) {
              var attesa = voce.expectedRevision;
              var esisteva = !!(attuale && attuale.exists);
              // dopo una cancellazione il documento non c'e': si crea di nuovo

              if (!esisteva) {
                // creazione: il documento non deve esistere gia'
                if (voce.tipo === 'delete') {
                  return { esito: ESITO.CONFLITTO,
                    dettaglio: 'Il record era gia\u2019 stato eliminato.' };
                }
                if (attesa !== null && attesa !== 0 && attesa !== revAttuale) {
                  return { esito: ESITO.CONFLITTO,
                    dettaglio: 'Il record non esiste piu\u2019.' };
                }
              } else {
                // modifica o cancellazione: revisione obbligatoria
                if (attesa === null || attesa === undefined) {
                  return { esito: ESITO.CONFLITTO,
                    dettaglio: 'Esiste gia\u2019 un record (revisione ' + revAttuale +
                      '): serve dire quale versione si sta modificando.' };
                }
                if (attesa !== revAttuale) {
                  return { esito: ESITO.CONFLITTO,
                    dettaglio: 'Modificato da qualcun altro (revisione ' +
                      revAttuale + ', tu avevi la ' + attesa + ').' };
                }
              }
            }

            // La revisione avanza sempre, anche quando si cancella:
            // e' il numero che distingue una cancellazione vecchia da
            // una versione successiva dello stesso record.
            var nuovaRev = revAttuale + 1;

            if (voce.tipo === 'delete') {
              // Non basta togliere il documento: gli altri dispositivi
              // non se ne accorgerebbero mai. Si lascia una lapide con
              // la revisione a cui la cancellazione si riferisce.
              // Se domani qualcuno ricrea il record, la sua revisione
              // sara' piu' alta e la lapide smettera' di valere da sola.
              t.delete(rifDoc);
              t.set(db.collection('eliminati').doc(voce.store + '__' + voce.recordId), {
                store: voce.store,
                recordId: voce.recordId,
                revision: nuovaRev,
                chi: utente.uid,
                quando: quando()
              });
            } else {
              var dati = JSON.parse(JSON.stringify(voce.dati));
              dati.revision = nuovaRev;
              dati.modificatoDa = utente.uid;
              dati.modificatoIl = quando();
              t.set(rifDoc, dati);
              // La lapide non si tocca: basta che questo documento abbia
              // una revisione piu' alta perche' smetta di avere effetto.
            }

            t.set(rifOp, {
              operationId: voce.operationId,
              store: voce.store,
              recordId: voce.recordId,
              tipo: voce.tipo,
              chi: utente.uid,
              quando: quando(),
              // La revisione prodotta da questa operazione, congelata:
              // e' quello che si risponde se la stessa operazione
              // ritorna dopo che la risposta si e' persa.
              revisionApplicata: nuovaRev
            });
            return { esito: ESITO.OK, revision: nuovaRev };
            });
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
      var store = App.data.schema.nomiStoreCondivisi;
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
      return catena.then(function () {
        return db.collection('eliminati').get().then(function (snap) {
          var lapidi = [];
          snap.forEach(function (d) { lapidi.push(d.data()); });
          risultato.__eliminati = lapidi;
          return risultato;
        }).catch(function () {
          risultato.__eliminati = [];
          return risultato;
        });
      });
    }

    // Il marker dell'inizializzazione: si scrive una volta sola.
    // Se esiste gia', la seconda scrittura fallisce e l'archivio
    // risulta correttamente "gia' inizializzato".
    // LETTURE STRETTE
    //
    // Per la sincronizzazione ordinaria un errore su una raccolta si puo'
    // tollerare: si riprovera'. Per decidere se l'archivio e' vuoto, se
    // esiste gia' un'inizializzazione, o se questo telefono appartiene a
    // quell'archivio, no: tradurre un permesso negato o una rete assente
    // in "non c'e' niente" porterebbe a cancellare o duplicare dati.
    // Queste funzioni non nascondono niente: se non si riesce a leggere,
    // l'errore arriva a chi ha chiamato.
    function leggiTuttoStrict() {
      var store = App.data.schema.nomiStoreCondivisi;
      var risultato = {};
      var catena = Promise.resolve();
      store.forEach(function (nome) {
        catena = catena.then(function () {
          return db.collection(nome).get().then(function (snap) {
            risultato[nome] = [];
            snap.forEach(function (d) { risultato[nome].push(d.data()); });
          });
        });
      });
      return catena.then(function () { return risultato; });
    }

    function leggiMarkerStrict(raccolta, id) {
      return db.collection(raccolta).doc(id).get().then(function (d) {
        return d && d.exists ? d.data() : null;
      });
    }

    function contaCondiviseStrict() {
      var store = App.data.schema.nomiStoreCondivisi;
      var totale = 0;
      var perStore = {};
      var catena = Promise.resolve();
      store.forEach(function (nome) {
        catena = catena.then(function () {
          return db.collection(nome).get().then(function (snap) {
            perStore[nome] = snap.size;
            totale += snap.size;
          });
        });
      });
      return catena.then(function () {
        return { totale: totale, perStore: perStore };
      });
    }

    // ACQUISIZIONE DELL'INIZIALIZZAZIONE
    //
    // Il marker non si scrive alla fine: si scrive all'INIZIO, con stato
    // IN_CORSO, dentro una transazione. Cosi' due amministratori che
    // partono nello stesso momento non possono caricare entrambi: il
    // secondo trova il documento e si ferma prima di scrivere un dato.
    //
    // Se il documento esiste ed e' IN_CORSO dello stesso amministratore,
    // si sta riprendendo un caricamento interrotto: si restituisce quello
    // che c'e' gia', senza ricominciare da capo.
    function acquisisciBootstrap(raccolta, id, dati, utente) {
      var rif = db.collection(raccolta).doc(id);
      return db.runTransaction(function (t) {
        return t.get(rif).then(function (doc) {
          if (doc && doc.exists) {
            var esistente = doc.data();
            if (esistente.stato === 'COMPLETO') {
              var e1 = new Error('L\u2019archivio condiviso è già stato inizializzato.');
              e1.codice = 'GIA_COMPLETO';
              throw e1;
            }
            if (esistente.amministratore !== utente.uid) {
              var e2 = new Error('Inizializzazione già in corso da parte di un altro ' +
                'amministratore.');
              e2.codice = 'ALTRO_IN_CORSO';
              throw e2;
            }
            // ripresa: e' la nostra, interrotta
            return { ripresa: true, marker: esistente };
          }
          var iniziale = {
            stato: 'IN_CORSO',
            identificativo: dati.identificativo,
            amministratore: utente.uid,
            versioneApp: dati.versioneApp,
            versioneSchema: dati.versioneSchema,
            iniziatoIl: quando()
          };
          t.set(rif, iniziale);
          return { ripresa: false, marker: iniziale };
        });
      });
    }

    // Chiusura: da IN_CORSO a COMPLETO. Solo chi l'ha acquisita, solo
    // una volta, e solo se lo stato di partenza e' quello giusto.
    function completaBootstrap(raccolta, id, conteggi, utente) {
      var rif = db.collection(raccolta).doc(id);
      return db.runTransaction(function (t) {
        return t.get(rif).then(function (doc) {
          if (!doc || !doc.exists) {
            throw new Error('Nessuna inizializzazione da completare.');
          }
          var m = doc.data();
          if (m.stato === 'COMPLETO') return m;   // gia' fatto: idempotente
          if (m.amministratore !== utente.uid) {
            throw new Error('L\u2019inizializzazione appartiene a un altro ' +
              'amministratore.');
          }
          var completo = {
            stato: 'COMPLETO',
            identificativo: m.identificativo,
            amministratore: m.amministratore,
            versioneApp: m.versioneApp,
            versioneSchema: m.versioneSchema,
            iniziatoIl: m.iniziatoIl,
            completatoIl: quando(),
            conteggi: conteggi
          };
          t.set(rif, completo);
          return completo;
        });
      });
    }

    // Contatore: idempotente in ripresa. Se c'e' gia' il valore atteso
    // va bene; se ce n'e' un altro ci si ferma, perche' vorrebbe dire
    // che qualcuno ha gia' assegnato dei codici.
    function impostaContatoreIdempotente(stagioneId, valore, utente) {
      var rif = db.collection('contatori').doc('capi_' + stagioneId);
      return db.runTransaction(function (t) {
        return t.get(rif).then(function (doc) {
          if (doc && doc.exists) {
            var attuale = doc.data().ultimo;
            if (attuale === valore) return { gia: true, ultimo: attuale };
            throw new Error('Il contatore dei capi della stagione ' + stagioneId +
              ' vale ' + attuale + ' invece di ' + valore +
              ': l\u2019inizializzazione non può proseguire.');
          }
          t.set(rif, { ultimo: valore, aggiornatoDa: utente.uid });
          return { gia: false, ultimo: valore };
        });
      });
    }

    function leggiMarker(raccolta, id) {
      return db.collection(raccolta).doc(id).get().then(function (doc) {
        return doc && doc.exists ? doc.data() : null;
      }).catch(function () { return null; });
    }

    // Allinea il contatore dei codici capo a quanto gia' esiste in
    // archivio: usato solo dall'inizializzazione, mai dall'uso normale.
    function impostaContatore(stagioneId, valore, utente) {
      var rif = db.collection('contatori').doc('capi_' + stagioneId);
      return db.runTransaction(function (t) {
        return t.get(rif).then(function (doc) {
          if (doc && doc.exists) {
            throw new Error('Il contatore dei capi esiste già per questa stagione.');
          }
          t.set(rif, { ultimo: valore, aggiornatoDa: utente.uid });
          return valore;
        });
      });
    }

    return {
      applica: applica,
      prossimoCodiceCapo: prossimoCodiceCapo,
      leggiTutto: leggiTutto,
      leggiMarker: leggiMarker,
      acquisisciBootstrap: acquisisciBootstrap,
      completaBootstrap: completaBootstrap,
      impostaContatoreIdempotente: impostaContatoreIdempotente,
      leggiTuttoStrict: leggiTuttoStrict,
      leggiMarkerStrict: leggiMarkerStrict,
      contaCondiviseStrict: contaCondiviseStrict,
      impostaContatore: impostaContatore
    };
  }

  App.data.adattatoreFirestore = { crea: creaAdattatore };
})(typeof window !== 'undefined' ? window : globalThis);

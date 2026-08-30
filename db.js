(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  var _db = null;

  // Crea gli store introdotti da una specifica versione dello schema.
  // Non tocca mai gli store gia' presenti: l'aggiornamento e' solo additivo.
  function creaStoreDiVersione(db, versione) {
    App.data.schema.storesDiVersione(versione).forEach(function (def) {
      if (db.objectStoreNames.contains(def.nome)) return;
      var store = db.createObjectStore(def.nome, { keyPath: def.keyPath });
      (def.indici || []).forEach(function (idx) {
        store.createIndex(idx.nome, idx.keyPath, idx.opzioni || {});
      });
    });
  }

  // Blocco della versione 1: meta, squadre, stagioni, membri, iscrizioni.
  function creaVersione1(db) { creaStoreDiVersione(db, 1); }

  // Blocco della versione 2: giornate e presenze.
  // Gli store della versione 1 non vengono letti, riscritti ne' cancellati.
  function creaVersione2(db) { creaStoreDiVersione(db, 2); }

  // Blocco della versione 3: abbattimenti.
  function creaVersione3(db) { creaStoreDiVersione(db, 3); }

  // Blocco della versione 4: controlli sanitari.
  function creaVersione4(db) { creaStoreDiVersione(db, 4); }

  function apri() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var schema = App.data.schema;
      var richiesta;
      try {
        richiesta = global.indexedDB.open(schema.dbName, schema.dbVersion);
      } catch (e) {
        reject(new Error('IndexedDB non disponibile in questo contesto. ' +
          "Apri l'app tramite un server HTTP locale, non con file://"));
        return;
      }

      richiesta.onupgradeneeded = function (ev) {
        var db = ev.target.result;
        var vecchia = ev.oldVersion;

        // Scaletta incrementale. Ogni blocco e' indipendente e cumulativo:
        // un'installazione nuova entra con oldVersion 0 e attraversa TUTTI
        // i blocchi in ordine; un'installazione gia' alla versione 2 entra
        // con oldVersion 2 ed esegue solo i blocchi successivi.
        //
        // Per aggiungere in futuro i moduli previsti dal piano basta alzare
        // schema.dbVersion e appendere un blocco:
        //
        //   if (vecchia < 5) { creaVersione5(db); }
        //
        // Mai un else, mai un break: i blocchi non si escludono a vicenda.
        // Ogni blocco deve solo AGGIUNGERE store o indici, mai cancellare
        // o riscrivere quelli dei blocchi precedenti.
        if (vecchia < 1) {
          creaVersione1(db);
        }
        if (vecchia < 2) {
          creaVersione2(db);
        }
        if (vecchia < 3) {
          creaVersione3(db);
        }
        if (vecchia < 4) {
          creaVersione4(db);
        }

        // Su un database preesistente meta.schemaVersion resterebbe fermo alla
        // versione precedente. Si aggiorna qui, nella stessa transazione di
        // upgrade, solo se la chiave esiste gia': su un'installazione nuova
        // (vecchia === 0) la scrive il seed, e anticiparla gli farebbe credere
        // che l'app sia gia' stata avviata.
        if (vecchia >= 1 && db.objectStoreNames.contains('meta')) {
          var storeMeta = ev.target.transaction.objectStore('meta');
          var lettura = storeMeta.get('schemaVersion');
          lettura.onsuccess = function () {
            if (!lettura.result) return;
            storeMeta.put({ chiave: 'schemaVersion', valore: App.versione.SCHEMA_VERSION });
          };
        }
      };

      richiesta.onsuccess = function () {
        _db = richiesta.result;
        _db.onversionchange = function () { _db.close(); _db = null; };
        resolve(_db);
      };
      richiesta.onerror = function () { reject(richiesta.error); };
      richiesta.onblocked = function () {
        reject(new Error("Database bloccato: chiudi le altre schede dell'app e riprova."));
      };
    });
  }

  function chiudi() {
    if (_db) { _db.close(); _db = null; }
  }

  App.data.db = { apri: apri, chiudi: chiudi };
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  function richiesta(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // Lettura di uno o piu' store in un'unica transazione di sola lettura.
  function leggiStore(nomi) {
    var elenco = Array.isArray(nomi) ? nomi : [nomi];
    return App.data.db.apri().then(function (db) {
      var t = db.transaction(elenco, 'readonly');
      var promesse = elenco.map(function (n) {
        return richiesta(t.objectStore(n).getAll()).then(function (r) {
          return { nome: n, record: r };
        });
      });
      return Promise.all(promesse).then(function (risultati) {
        var out = {};
        risultati.forEach(function (r) { out[r.nome] = r.record; });
        return out;
      });
    });
  }

  function getAll(nome) {
    return leggiStore(nome).then(function (o) { return o[nome]; });
  }

  function get(nome, chiave) {
    return App.data.db.apri().then(function (db) {
      return richiesta(db.transaction([nome], 'readonly').objectStore(nome).get(chiave));
    });
  }

  function getPerIndice(nome, indice, valore) {
    return App.data.db.apri().then(function (db) {
      var store = db.transaction([nome], 'readonly').objectStore(nome);
      return richiesta(store.index(indice).getAll(valore));
    });
  }

  // Scrittura atomica. La funzione ricevuta DEVE emettere solo richieste
  // IndexedDB in modo sincrono: nessun await su promesse esterne, altrimenti
  // la transazione si chiude prima del tempo.
  function scrivi(nomi, fn) {
    var elenco = Array.isArray(nomi) ? nomi : [nomi];
    return App.data.db.apri().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(elenco, 'readwrite');
        var risultato;
        var errore = null;
        var api = {
          store: function (n) { return t.objectStore(n); },
          put: function (n, oggetto) { t.objectStore(n).put(oggetto); return oggetto; },
          elimina: function (n, chiave) { t.objectStore(n).delete(chiave); },
          svuota: function (n) { t.objectStore(n).clear(); }
        };
        t.oncomplete = function () { errore ? reject(errore) : resolve(risultato); };
        t.onabort = function () { reject(errore || t.error || new Error('Transazione annullata.')); };
        t.onerror = function () { if (!errore) errore = t.error; };
        try {
          risultato = fn(api, t);
        } catch (e) {
          errore = e;
          try { t.abort(); } catch (_) { /* gia' abortita */ }
        }
      });
    });
  }

  function oraIso() { return new Date().toISOString(); }

  function timbraCreazione(oggetto) {
    var ora = oraIso();
    oggetto.creatoIl = oggetto.creatoIl || ora;
    oggetto.aggiornatoIl = ora;
    return oggetto;
  }

  function timbraModifica(oggetto) {
    oggetto.aggiornatoIl = oraIso();
    return oggetto;
  }

  App.data.repo = {
    richiesta: richiesta,
    leggiStore: leggiStore,
    getAll: getAll,
    get: get,
    getPerIndice: getPerIndice,
    scrivi: scrivi,
    oraIso: oraIso,
    timbraCreazione: timbraCreazione,
    timbraModifica: timbraModifica
  };
})(typeof window !== 'undefined' ? window : globalThis);

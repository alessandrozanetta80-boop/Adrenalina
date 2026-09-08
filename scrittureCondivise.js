(function (global) {
  'use strict';
  var App = global.App;
  App.data = App.data || {};

  // MODALITA' CONDIVISA
  //
  // Quando l'app lavora in solitaria (Firebase non configurato) niente
  // cambia: i service scrivono su IndexedDB come hanno sempre fatto.
  //
  // Quando invece la squadra condivide l'archivio, ogni modifica deve
  // anche finire nella coda da inviare. Invece di ritoccare uno per uno
  // i service, si intercetta l'unico punto da cui passano tutte le
  // scritture: repo.scrivi().
  //
  // Il vantaggio non e' solo la brevita'. Cosi' il dato locale e la sua
  // voce di coda finiscono nella STESSA transazione: o si scrive tutto,
  // o non si scrive niente. Un'operazione della carne che tocca lotto,
  // quote e vendite non puo' lasciare il telefono a meta'.

  var attiva = false;
  var motore = null;
  var scriviOriginale = null;

  // Store che vengono condivisi. Gli altri (coda, registro) restano qui.
  function condiviso(store) {
    return App.data.schema.nomiStoreCondivisi.indexOf(store) !== -1;
  }

  // La revisione su cui l'utente ha basato la modifica: quella del
  // record com'era prima di questa scrittura. Non si inventa e non si
  // usa quella corrente dopo la modifica.
  function revisioneDi(record) {
    if (!record) return null;
    return typeof record.revision === 'number' ? record.revision : null;
  }

  var avvisaCheCeCoda = null;

  // Chi ha accesso in sola lettura non deve poter modificare niente,
  // nemmeno chiamando un service dalla console del browser. Il blocco
  // sta qui, sotto ai service: e' l'unico punto da cui passano tutte le
  // scritture. Le Rules lo negano comunque, ma non si arriva neanche
  // a chiedere.
  function installaSolaLettura() {
    if (attiva) return;
    attiva = true;
    scriviOriginale = App.data.repo.scrivi;
    App.data.repo.scriviSenzaCoda = function (nomi, fn) {
      return scriviOriginale.call(App.data.repo, nomi, fn);
    };
    App.data.repo.scrivi = function (nomi, fn) {
      var elenco = Array.isArray(nomi) ? nomi : [nomi];
      var suiDati = elenco.filter(function (n) {
        return App.data.schema.nomiStoreCondivisi.indexOf(n) !== -1;
      });
      if (suiDati.length) {
        return Promise.reject(new Error(
          'Il tuo accesso è in sola lettura: non puoi modificare i dati ' +
          'della squadra.'));
      }
      return scriviOriginale.call(App.data.repo, nomi, fn);
    };
  }

  function installa(sync, dopoScrittura) {
    if (attiva) return;
    avvisaCheCeCoda = dopoScrittura || null;
    if (!scriviOriginale) scriviOriginale = App.data.repo.scrivi;
    motore = sync;
    attiva = true;

    // Via di servizio per il motore: quello che ARRIVA dal remoto va
    // scritto in locale senza rimetterlo in coda, altrimenti ogni
    // sincronizzazione rispedirebbe indietro cio' che ha appena ricevuto.
    App.data.repo.scriviSenzaCoda = function (nomi, fn) {
      return scriviOriginale.call(App.data.repo, nomi, fn);
    };

    App.data.repo.scrivi = function (nomi, fn) {
      var elenco = Array.isArray(nomi) ? nomi : [nomi];
      // Nulla da condividere: si passa oltre senza toccare niente.
      var daCondividere = elenco.filter(condiviso);
      if (!attiva || !motore || !daCondividere.length) {
        return scriviOriginale.call(App.data.repo, nomi, fn);
      }

      // Serve conoscere lo stato precedente per sapere su quale
      // revisione l'utente sta lavorando.
      return App.data.repo.leggiStore(daCondividere).then(function (prima) {
        var indice = {};
        daCondividere.forEach(function (n) {
          indice[n] = {};
          prima[n].forEach(function (r) { indice[n][r.id] = r; });
        });

        var conCoda = elenco.slice();
        if (conCoda.indexOf('outbox') === -1) conCoda.push('outbox');

        var operazioniProdotte = 0;
        // vecchio identificativo -> nuovo, dentro questa transazione
        var rinominati = {};
        return scriviOriginale.call(App.data.repo, conCoda, function (api, t) {
          var operazioni = [];

          // Si avvolgono put ed elimina: fanno quello di sempre e in
          // piu' preparano l'operazione da inviare.
          var apiIntercettata = {
            store: api.store,
            svuota: api.svuota,
            put: function (n, oggetto) {
              if (condiviso(n)) {
                // Se in questa stessa transazione un record ha cambiato
                // identificativo (da casuale a calcolato), chi lo cita
                // deve seguirlo: altrimenti una quota resterebbe legata
                // a un lotto che non esiste piu'.
                Object.keys(oggetto).forEach(function (campo) {
                  var v = oggetto[campo];
                  if (typeof v === 'string' && rinominati[v]) oggetto[campo] = rinominati[v];
                });
              }
              if (condiviso(n)) {
                // Dove l'unicita' e' una regola vera (una presenza per
                // socio e giornata, un lotto per giornata...) l'identificativo
                // si calcola dai dati. Due dispositivi che segnano la stessa
                // cosa scrivono lo stesso documento invece di crearne due.
                var calcolato = App.core.idDeterministici.deterministico(n)
                  ? App.core.idDeterministici.calcola(n, oggetto) : null;
                if (calcolato && oggetto.id !== calcolato) {
                  if (oggetto.id) rinominati[oggetto.id] = calcolato;
                  // il record aveva un identificativo casuale: si sostituisce
                  if (oggetto.id) {
                    api.elimina(n, oggetto.id);
                    operazioni.push({
                      tipo: 'delete', store: n, recordId: oggetto.id, dati: null,
                      expectedRevision: revisioneDi(indice[n] && indice[n][oggetto.id])
                    });
                  }
                  oggetto.id = calcolato;
                }
              }
              var risultato = api.put(n, oggetto);
              if (condiviso(n)) {
                operazioni.push({
                  tipo: 'put', store: n, recordId: oggetto.id,
                  dati: oggetto,
                  expectedRevision: revisioneDi(indice[n] && indice[n][oggetto.id])
                });
              }
              return risultato;
            },
            elimina: function (n, chiave) {
              api.elimina(n, chiave);
              if (condiviso(n)) {
                operazioni.push({
                  tipo: 'delete', store: n, recordId: chiave, dati: null,
                  expectedRevision: revisioneDi(indice[n] && indice[n][chiave])
                });
              }
            }
          };

          var risultato = fn(apiIntercettata, t);

          // Le voci di coda entrano nella stessa transazione.
          operazioni.forEach(function (op) {
            api.put('outbox', motore.vocePerCoda(op));
          });
          operazioniProdotte = operazioni.length;
          return risultato;
        }).then(function (risultato) {
          // Salvato in locale. Solo adesso si chiede di inviare: il
          // salvataggio non aspetta la rete e un errore remoto non lo
          // annulla.
          if (operazioniProdotte && avvisaCheCeCoda) avvisaCheCeCoda();
          return risultato;
        });
      });
    };
  }

  function disinstalla() {
    avvisaCheCeCoda = null;
    if (!attiva) return;
    if (scriviOriginale) App.data.repo.scrivi = scriviOriginale;
    delete App.data.repo.scriviSenzaCoda;
    attiva = false;
    motore = null;
  }

  App.data.scrittureCondivise = {
    installa: installa,
    installaSolaLettura: installaSolaLettura,
    disinstalla: disinstalla,
    attiva: function () { return attiva; },
    condiviso: condiviso
  };
})(typeof window !== 'undefined' ? window : globalThis);
